import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CYCLE_PHASES } from "@/lib/cycle";
import { fallbackParams, MAIA_MODEL, MISSING_KEY_ERROR } from "@/lib/maia/client";
import {
  MAIA_SYSTEM_PROMPT,
  SAVE_WEEK_PLAN_TOOL,
  planningContext,
} from "@/lib/maia/prompt";
import { requireUser } from "@/lib/server-auth";
import { WeekPlanSchema, describeTotals, type WeekPlan } from "@/lib/plan";

// A full week plan can take a minute or two to write.
export const maxDuration = 300;

// Max model calls per user message: reply, save, adjust and save again, summary.
const MAX_STEPS = 5;

const RequestSchema = z.object({
  // Earlier turns exactly as returned by this route. Sent back unchanged
  // (append-only), which the API requires for thinking blocks.
  history: z.array(z.custom<Anthropic.Beta.BetaMessageParam>()),
  message: z.string().max(4000),
  // Photos uploaded through /api/maia/upload, by Files API id.
  imageFileIds: z.array(z.string().regex(/^file_[A-Za-z0-9_-]+$/)).max(4).default([]),
  context: z.object({
    target: z.object({
      calories: z.number(),
      proteinG: z.number(),
      carbsG: z.number(),
      fatG: z.number(),
    }),
    weekStart: z.string(),
    weekEnd: z.string(),
    phases: z.array(z.enum(CYCLE_PHASES)),
    mode: z.enum(["prep", "daily"]),
  }),
});

/** Events streamed to the browser, one JSON object per line. */
export type MaiaEvent =
  | { type: "text"; text: string }
  | { type: "plan"; plan: WeekPlan }
  | { type: "done"; newMessages: Anthropic.Beta.BetaMessageParam[] }
  | { type: "error"; message: string };

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: MISSING_KEY_ERROR },
      { status: 500 },
    );
  }
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const { history, message, context, imageFileIds } = parsed.data;
  if (!message.trim() && imageFileIds.length === 0) {
    return Response.json({ error: "Write a message or add a photo." }, { status: 400 });
  }

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: MaiaEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      const newMessages: Anthropic.Beta.BetaMessageParam[] = [
        {
          role: "user",
          content: [
            { type: "text", text: planningContext(context) },
            ...imageFileIds.map(
              (file_id): Anthropic.Beta.BetaImageBlockParam => ({ type: "image", source: { type: "file", file_id } }),
            ),
            { type: "text", text: message.trim() || "Here's a photo." },
          ],
        },
      ];

      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          const response = client.beta.messages.stream({
            model: MAIA_MODEL,
            max_tokens: 64000,
            ...fallbackParams(),
            output_config: { effort: "medium" },
            cache_control: { type: "ephemeral" },
            system: MAIA_SYSTEM_PROMPT,
            tools: [SAVE_WEEK_PLAN_TOOL],
            messages: [...history, ...newMessages],
          });
          response.on("text", (text) => send({ type: "text", text }));

          let final: Anthropic.Beta.BetaMessage;
          try {
            final = await response.finalMessage();
          } catch (err) {
            if (err instanceof Anthropic.APIError) throw err;
            // Tool input that isn't parseable JSON; ask again.
            continue;
          }

          if (final.stop_reason === "refusal") {
            send({ type: "error", message: "Maia couldn't answer that. Try rephrasing." });
            return;
          }
          if (final.stop_reason === "pause_turn") {
            newMessages.push({ role: "assistant", content: final.content });
            continue;
          }

          const toolUses = final.content.filter(
            (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
          );
          if (toolUses.length === 0) {
            newMessages.push({ role: "assistant", content: final.content });
            send({ type: "done", newMessages });
            return;
          }
          if (final.stop_reason === "max_tokens") {
            send({ type: "error", message: "The plan was too long to finish. Try planning fewer days." });
            return;
          }

          newMessages.push({ role: "assistant", content: final.content });
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((tool) => {
            const plan = tool.name === "save_week_plan" ? WeekPlanSchema.safeParse(tool.input) : null;
            if (!plan?.success) {
              return {
                type: "tool_result",
                tool_use_id: tool.id,
                is_error: true,
                content: JSON.stringify({
                  INVALID_INPUT: plan ? z.prettifyError(plan.error) : `Unknown tool ${tool.name}`,
                }),
              };
            }
            send({ type: "plan", plan: plan.data });
            return {
              type: "tool_result",
              tool_use_id: tool.id,
              content: `Saved. Daily totals computed by the app (difference from target in brackets):\n${describeTotals(plan.data, context.target)}`,
            };
          });
          newMessages.push({ role: "user", content: results });
        }
        send({ type: "error", message: "Maia took too many steps. Please try again." });
      } catch (err) {
        console.error("Maia request failed", err);
        const message =
          err instanceof Anthropic.AuthenticationError
            ? "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY."
            : err instanceof Anthropic.RateLimitError
              ? "Maia is busy (rate limited). Wait a minute and try again."
              : "Something went wrong talking to Maia. Please try again.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

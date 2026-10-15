import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CYCLE_PHASES } from "@/lib/cycle";
import { describeMaiaError, fallbackParams, MAIA_MODEL, MISSING_KEY_ERROR } from "@/lib/maia/client";
import {
  MAIA_SYSTEM_PROMPT,
  REMOVE_FAVORITE_TOOL,
  SAVE_FAVORITE_TOOL,
  SAVE_WEEK_PLAN_TOOL,
  planningContext,
} from "@/lib/maia/prompt";
import {
  RemoveFavoriteInput,
  removeFavorite,
  SaveFavoriteInput,
  saveFavorite,
} from "@/lib/server/favorite-tools";
import { describeFavorites, type Favorite } from "@/lib/favorites";
import { bearerToken, requireUser, userClient } from "@/lib/server-auth";
import { WeekPlanSchema, describeTotals, type WeekPlan } from "@/lib/plan";

// A full week plan can take a minute or two to write.
export const maxDuration = 300;

// Max model calls per user message: reply, save favorites/plan, adjust and save again, summary.
const MAX_STEPS = 8;

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
    today: z.string(),
    phases: z.array(z.enum(CYCLE_PHASES)),
    mode: z.enum(["prep", "daily"]),
  }),
});

/** Events streamed to the browser, one JSON object per line. */
export type MaiaEvent =
  | { type: "text"; text: string }
  | { type: "plan"; plan: WeekPlan }
  /** Maia changed a favorite; the app should reload them. */
  | { type: "favorites" }
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
  const userId = user.id;

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const { history, message, context, imageFileIds } = parsed.data;
  // Her saved favorites, read as her (row level security applies).
  const db = userClient(bearerToken(request)!);
  const favorites = await db
    .from("favorites")
    .select("id, slot, meal")
    .order("created_at")
    .returns<Favorite[]>();
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
            {
              type: "text",
              text: planningContext({ ...context, favorites: describeFavorites(favorites.data ?? []) }),
            },
            ...imageFileIds.map(
              (file_id): Anthropic.Beta.BetaImageBlockParam => ({ type: "image", source: { type: "file", file_id } }),
            ),
            { type: "text", text: message.trim() || "Here's a photo." },
          ],
        },
      ];

      const toolError = (tool: Anthropic.Beta.BetaToolUseBlock, message: string): Anthropic.Beta.BetaToolResultBlockParam => ({
        type: "tool_result",
        tool_use_id: tool.id,
        is_error: true,
        content: message,
      });

      /** Runs one of Maia's tools and returns its result for her. */
      async function runTool(tool: Anthropic.Beta.BetaToolUseBlock): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
        if (tool.name === "save_week_plan") {
          const plan = WeekPlanSchema.safeParse(tool.input);
          if (!plan.success) return toolError(tool, JSON.stringify({ INVALID_INPUT: z.prettifyError(plan.error) }));
          send({ type: "plan", plan: plan.data });
          return {
            type: "tool_result",
            tool_use_id: tool.id,
            content: `Saved. Daily totals computed by the app (difference from target in brackets):\n${describeTotals(plan.data, context.target)}`,
          };
        }
        if (tool.name === "save_favorite" || tool.name === "remove_favorite") {
          try {
            let outcome: string;
            if (tool.name === "save_favorite") {
              const input = SaveFavoriteInput.safeParse(tool.input);
              if (!input.success) return toolError(tool, JSON.stringify({ INVALID_INPUT: z.prettifyError(input.error) }));
              outcome = await saveFavorite(db, userId, input.data);
            } else {
              const input = RemoveFavoriteInput.safeParse(tool.input);
              if (!input.success) return toolError(tool, JSON.stringify({ INVALID_INPUT: z.prettifyError(input.error) }));
              outcome = await removeFavorite(db, input.data);
            }
            send({ type: "favorites" });
            return { type: "tool_result", tool_use_id: tool.id, content: outcome };
          } catch (err) {
            return toolError(tool, `Failed: ${(err as Error).message}`);
          }
        }
        return toolError(tool, `Unknown tool ${tool.name}`);
      }

      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          const fallback = fallbackParams();
          const response = client.beta.messages.stream({
            model: MAIA_MODEL,
            max_tokens: 64000,
            ...fallback,
            // Maia's thinking from earlier turns is tied to the exact system
            // prompt and tools it was written under. When the app updates
            // Maia's instructions mid-week, set those blocks aside instead of
            // rejecting the conversation (she still sees the whole chat).
            betas: [...fallback.betas, "thinking-binding-controls-2026-08-01"],
            thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
            output_config: { effort: "medium" },
            cache_control: { type: "ephemeral" },
            system: MAIA_SYSTEM_PROMPT,
            tools: [SAVE_WEEK_PLAN_TOOL, SAVE_FAVORITE_TOOL, REMOVE_FAVORITE_TOOL],
            messages: [...history, ...newMessages],
          });
          response.on("text", (text) => send({ type: "text", text }));

          let final: Anthropic.Beta.BetaMessage;
          try {
            final = await response.finalMessage();
            const dropped = (final.input_transformations ?? []).length;
            if (dropped) console.info(`Maia: set aside ${dropped} outdated thinking block(s)`, final.input_transformations);
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
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const tool of toolUses) {
            results.push(await runTool(tool));
          }
          newMessages.push({ role: "user", content: results });
        }
        send({ type: "error", message: "Maia took too many steps. Please try again." });
      } catch (err) {
        send({ type: "error", message: describeMaiaError(err, "Maia planning request") });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

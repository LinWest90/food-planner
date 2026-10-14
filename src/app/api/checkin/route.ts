import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CHECKIN_SYSTEM_PROMPT, CheckInResponseSchema } from "@/lib/maia/checkin-prompt";
import { fallbackParams, MAIA_MODEL, MISSING_KEY_ERROR } from "@/lib/maia/client";
import { requireUser } from "@/lib/server-auth";
import { MealSchema, type Meal } from "@/lib/plan";

export const maxDuration = 120;

const TotalsSchema = z.object({
  calories: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
});

const RequestSchema = z.object({
  date: z.string(),
  description: z.string().min(1).max(2000),
  /** The planned meal this replaces; absent for extra food. */
  replaces: MealSchema.nullable(),
  target: TotalsSchema,
  eatenToday: TotalsSchema,
  remaining: z.array(z.object({ date: z.string(), index: z.number(), meal: MealSchema })).max(40),
});

export interface CheckInResult {
  ate: { name: string; calories: number; proteinG: number; carbsG: number; fatG: number };
  message: string;
  adjustments: { date: string; index: number; meal: Meal }[];
}

const describeMeal = (m: Meal) =>
  `${m.name} (${Math.round(m.calories)} kcal, P ${Math.round(m.proteinG)} g, C ${Math.round(m.carbsG)} g, F ${Math.round(m.fatG)} g)`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: MISSING_KEY_ERROR }, { status: 500 });
  }
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const { date, description, replaces, target, eatenToday, remaining } = parsed.data;

  const prompt = [
    `Today is ${date}.`,
    `Daily targets: ${target.calories} kcal, protein ${target.proteinG} g, carbs ${target.carbsG} g, fat ${target.fatG} g.`,
    `Eaten so far today (before this): ${eatenToday.calories} kcal, P ${eatenToday.proteinG} g, C ${eatenToday.carbsG} g, F ${eatenToday.fatG} g.`,
    replaces
      ? `Planned meal that didn't happen: ${replaces.slot}, ${describeMeal(replaces)}.`
      : "This was extra food, not replacing a planned meal.",
    "",
    "Remaining planned meals (date / index / slot / meal):",
    remaining.length
      ? remaining.map((r) => `${r.date} / ${r.index} / ${r.meal.slot} / ${describeMeal(r.meal)}`).join("\n")
      : "(none)",
    "",
    `What she ate instead, in her words:\n"""${description}"""`,
  ].join("\n");

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: MAIA_MODEL,
      max_tokens: 16000,
      ...fallbackParams(),
      output_config: { effort: "medium", format: betaZodOutputFormat(CheckInResponseSchema) },
      system: CHECKIN_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "Maia couldn't log that. Try describing it differently." }, { status: 502 });
    }
    const out = response.parsed_output;

    // Only accept changes to meals that were offered and still parse as meals.
    const allowed = new Set(remaining.map((r) => `${r.date}/${r.index}`));
    const adjustments = out.adjustments.flatMap((a) => {
      const meal = MealSchema.safeParse(a.meal);
      return meal.success && allowed.has(`${a.date}/${a.index}`)
        ? [{ date: a.date, index: a.index, meal: meal.data }]
        : [];
    });

    const clamp = (n: number) => Math.max(0, Math.round(n));
    const result: CheckInResult = {
      ate: {
        name: out.ate.name,
        calories: clamp(out.ate.calories),
        proteinG: clamp(out.ate.proteinG),
        carbsG: clamp(out.ate.carbsG),
        fatG: clamp(out.ate.fatG),
      },
      message: out.message,
      adjustments,
    };
    return Response.json(result);
  } catch (err) {
    console.error("Check-in request failed", err);
    const message =
      err instanceof Anthropic.AuthenticationError
        ? "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY."
        : err instanceof Anthropic.RateLimitError
          ? "Maia is busy (rate limited). Wait a minute and try again."
          : "Something went wrong talking to Maia. Please try again.";
    return Response.json({ error: message }, { status: 502 });
  }
}

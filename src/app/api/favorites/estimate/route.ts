import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { fallbackParams, MAIA_MODEL, MISSING_KEY_ERROR } from "@/lib/maia/client";
import { FAVORITE_SYSTEM_PROMPT, FavoriteDraftSchema } from "@/lib/maia/favorite-prompt";
import { MEAL_SLOTS, MealSchema } from "@/lib/plan";
import { requireUser } from "@/lib/server-auth";

export const maxDuration = 120;

const RequestSchema = z.object({
  slot: z.enum(MEAL_SLOTS),
  description: z.string().max(4000),
  imageFileIds: z.array(z.string().regex(/^file_[A-Za-z0-9_-]+$/)).max(4).default([]),
});

/** Turns a description (and photos) into a favorite meal with estimated macros, for her to review and save. */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: MISSING_KEY_ERROR }, { status: 500 });
  }
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { slot, description, imageFileIds } = parsed.data;
  if (!description.trim() && imageFileIds.length === 0) {
    return Response.json({ error: "Describe the meal or add a photo." }, { status: 400 });
  }

  try {
    const response = await new Anthropic().beta.messages.parse({
      model: MAIA_MODEL,
      max_tokens: 16000,
      ...fallbackParams(),
      output_config: { effort: "medium", format: betaZodOutputFormat(FavoriteDraftSchema) },
      system: FAVORITE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...imageFileIds.map(
              (file_id): Anthropic.Beta.BetaImageBlockParam => ({ type: "image", source: { type: "file", file_id } }),
            ),
            {
              type: "text",
              text: `Meal type: ${slot}\n\n${description.trim() ? `Her description:\n"""${description.trim()}"""` : "No description; go by the photo."}`,
            },
          ],
        },
      ],
    });
    const out = response.parsed_output;
    if (response.stop_reason === "refusal" || !out) {
      return Response.json({ error: "Maia couldn't work that one out. Try describing it differently." }, { status: 502 });
    }
    const clamp = (n: number) => Math.max(0, Math.round(n));
    const meal = MealSchema.safeParse({
      slot,
      name: out.name,
      ingredients: out.ingredients,
      calories: clamp(out.calories),
      proteinG: clamp(out.proteinG),
      carbsG: clamp(out.carbsG),
      fatG: clamp(out.fatG),
    });
    if (!meal.success) {
      return Response.json({ error: "Maia's answer was incomplete. Please try again." }, { status: 502 });
    }
    return Response.json({ meal: meal.data, note: out.note });
  } catch (err) {
    console.error("Favorite estimate failed", err);
    const message =
      err instanceof Anthropic.AuthenticationError
        ? "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY."
        : err instanceof Anthropic.RateLimitError
          ? "Maia is busy (rate limited). Wait a minute and try again."
          : "Something went wrong talking to Maia. Please try again.";
    return Response.json({ error: message }, { status: 502 });
  }
}

// Has Maia write up one serving of a meal (from a description, photos or an
// imported recipe) with ingredients and macros, for the user to review.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { describeMaiaError, fallbackParams, MAIA_MODEL } from "../maia/client";
import { FAVORITE_SYSTEM_PROMPT, FavoriteDraftSchema } from "../maia/favorite-prompt";
import { MealSchema, type Meal } from "../plan";

export class DraftError extends Error {}

export async function draftFavorite(
  slot: Meal["slot"],
  text: string,
  imageFileIds: string[] = [],
): Promise<{ meal: Meal; note: string }> {
  let out;
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
            { type: "text", text: `Meal type: ${slot}\n\n${text}` },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new DraftError("Maia couldn't work that one out. Try describing it differently.");
    }
    out = response.parsed_output;
  } catch (err) {
    if (err instanceof DraftError) throw err;
    throw new DraftError(describeMaiaError(err, "Favorite draft"));
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
  if (!meal.success) throw new DraftError("Maia's answer was incomplete. Please try again.");
  return { meal: meal.data, note: out.note };
}

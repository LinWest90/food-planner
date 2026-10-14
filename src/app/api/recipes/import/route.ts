import { z } from "zod";
import { MISSING_KEY_ERROR } from "@/lib/maia/client";
import { MEAL_SLOTS } from "@/lib/plan";
import { describeRecipe, extractRecipe, hasUsableRecipe } from "@/lib/recipe-extract";
import { requireUser } from "@/lib/server-auth";
import { draftFavorite } from "@/lib/server/draft-favorite";
import { fetchPage, FetchPageError } from "@/lib/server/fetch-page";

export const maxDuration = 120;

const RequestSchema = z.object({
  url: z.string().max(2000),
  slot: z.enum(MEAL_SLOTS),
  note: z.string().max(1000).default(""),
});

/**
 * Imports a recipe from a link: fetches the page, reads the recipe from it,
 * and has Maia write up one serving with macros, for her to review and save
 * as a favorite (with the steps and source link).
 */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: MISSING_KEY_ERROR }, { status: 500 });
  }
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { url, slot, note } = parsed.data;

  try {
    const page = await fetchPage(url);
    const recipe = extractRecipe(page.html);
    if (!hasUsableRecipe(recipe)) {
      return Response.json(
        {
          error:
            "Couldn't find a recipe on that page (social posts often hide it behind a login). Copy the recipe or caption text and add it as a description instead.",
        },
        { status: 422 },
      );
    }
    const text = [describeRecipe(recipe, page.url), note.trim() ? `\nHer note: """${note.trim()}"""` : ""].join("");
    const draft = await draftFavorite(slot, text);
    return Response.json({
      ...draft,
      meal: { ...draft.meal, sourceUrl: page.url, steps: recipe.steps.slice(0, 40) },
      found: recipe.source,
    });
  } catch (err) {
    const status = err instanceof FetchPageError ? 422 : 502;
    return Response.json({ error: (err as Error).message }, { status });
  }
}

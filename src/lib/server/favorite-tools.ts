// Runs Maia's favorites tools (save_favorite, remove_favorite) as the
// signed-in user, so row level security applies.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Favorite, FavoriteMeal } from "../favorites";
import { MEAL_SLOTS, MealSchema } from "../plan";

export const SaveFavoriteInput = z.object({
  slot: z.enum(MEAL_SLOTS),
  name: z.string().min(1).max(120),
  ingredients: z.array(z.object({ item: z.string(), quantity: z.string() })),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  /** Name of the existing favorite this updates, when renaming it. */
  replaces: z.string().optional(),
});

export const RemoveFavoriteInput = z.object({
  slot: z.enum(MEAL_SLOTS),
  name: z.string().min(1),
});

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function findFavorite(db: SupabaseClient, slot: string, name: string): Promise<Favorite | undefined> {
  const { data, error } = await db.from("favorites").select("id, slot, meal").eq("slot", slot).returns<Favorite[]>();
  if (error) throw new Error(`couldn't read favorites (${error.message})`);
  return (data ?? []).find((f) => sameName(f.meal.name, name));
}

/** Adds a favorite, or updates the one with the same name (or `replaces`) in that slot. Returns a result for Maia. */
export async function saveFavorite(db: SupabaseClient, userId: string, input: z.infer<typeof SaveFavoriteInput>) {
  const { replaces, ...fields } = input;
  const round = (n: number) => Math.round(n);
  const meal = MealSchema.parse({
    ...fields,
    calories: round(fields.calories),
    proteinG: round(fields.proteinG),
    carbsG: round(fields.carbsG),
    fatG: round(fields.fatG),
  });
  const existing = await findFavorite(db, meal.slot, replaces ?? meal.name);
  if (existing) {
    // Keep an imported recipe's link and steps.
    const updated: FavoriteMeal = { ...existing.meal, ...meal };
    const { error } = await db.from("favorites").update({ meal: updated }).eq("id", existing.id);
    if (error) throw new Error(`couldn't update the favorite (${error.message})`);
    return `Updated favorite ${meal.slot} "${existing.meal.name}"${existing.meal.name !== meal.name ? ` (now "${meal.name}")` : ""}.`;
  }
  const { error } = await db.from("favorites").insert({ user_id: userId, slot: meal.slot, meal });
  if (error?.code === "23505") return `A favorite ${meal.slot} called "${meal.name}" already exists; nothing changed.`;
  if (error) throw new Error(`couldn't save the favorite (${error.message})`);
  return `Saved new favorite ${meal.slot} "${meal.name}".`;
}

export async function removeFavorite(db: SupabaseClient, input: z.infer<typeof RemoveFavoriteInput>) {
  const existing = await findFavorite(db, input.slot, input.name);
  if (!existing) return `No favorite ${input.slot} called "${input.name}" was found; nothing removed.`;
  const { error } = await db.from("favorites").delete().eq("id", existing.id);
  if (error) throw new Error(`couldn't remove the favorite (${error.message})`);
  return `Removed favorite ${input.slot} "${existing.meal.name}".`;
}

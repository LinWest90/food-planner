// Reads and writes favorite meals (see supabase/migrations/*_favorites.sql).
import { check, userId } from "./data";
import type { Favorite } from "./favorites";
import type { Meal } from "./plan";
import { supabase } from "./supabase";

export async function fetchFavorites(): Promise<Favorite[]> {
  return (
    check(
      await supabase().from("favorites").select("id, slot, meal").order("created_at").returns<Favorite[]>(),
    ) ?? []
  );
}

/** Saves a meal as a favorite (without plan-specific notes). */
export async function addFavorite(meal: Meal): Promise<Favorite> {
  const saved: Meal = { ...meal };
  delete saved.why;
  const { data, error } = await supabase()
    .from("favorites")
    .insert({ user_id: await userId(), slot: meal.slot, meal: saved })
    .select("id, slot, meal")
    .single<Favorite>();
  if (error?.code === "23505") throw new Error(`"${meal.name}" is already a favorite.`);
  if (error || !data) throw new Error(`Couldn't save the favorite: ${error?.message ?? "unknown error"}`);
  return data;
}

export async function deleteFavorite(id: number): Promise<void> {
  check(await supabase().from("favorites").delete().eq("id", id));
}

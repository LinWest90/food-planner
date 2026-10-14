import type { Meal } from "./plan.ts";

/** A saved meal; imported recipes also keep their source link and steps. */
export type FavoriteMeal = Meal & { sourceUrl?: string; steps?: string[] };

export interface Favorite {
  id: number;
  slot: Meal["slot"];
  meal: FavoriteMeal;
}

const key = (slot: string, name: string) => `${slot}:${name.trim().toLowerCase()}`;

/** The saved favorite matching this meal (same slot and name), if any. */
export function findFavorite(favorites: Favorite[], meal: Pick<Meal, "slot" | "name">): Favorite | undefined {
  const k = key(meal.slot, meal.name);
  return favorites.find((f) => key(f.slot, f.meal.name) === k);
}

/** Compact list of favorites for Maia's planning context. */
export function describeFavorites(favorites: Favorite[]): string {
  if (favorites.length === 0) return "none saved yet";
  return favorites
    .map((f) => {
      const m = f.meal;
      const ingredients = m.ingredients.map((i) => `${i.quantity} ${i.item}`).join(", ");
      return `- ${f.slot}: ${m.name} (${Math.round(m.calories)} kcal, P ${Math.round(m.proteinG)} g, C ${Math.round(m.carbsG)} g, F ${Math.round(m.fatG)} g)${ingredients ? `: ${ingredients}` : ""}`;
    })
    .join("\n");
}

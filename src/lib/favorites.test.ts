import { test } from "node:test";
import assert from "node:assert/strict";
import { describeFavorites, findFavorite, type Favorite } from "./favorites.ts";

const fav: Favorite = {
  id: 1,
  slot: "breakfast",
  meal: {
    slot: "breakfast",
    name: "Protein Overnight Oats",
    ingredients: [{ item: "oats", quantity: "1/2 cup" }],
    calories: 489.6,
    proteinG: 45,
    carbsG: 55,
    fatG: 9,
  },
};

test("finds favorites by slot and name, ignoring case and spaces", () => {
  assert.equal(findFavorite([fav], { slot: "breakfast", name: " protein overnight oats " }), fav);
  assert.equal(findFavorite([fav], { slot: "snack", name: "Protein Overnight Oats" }), undefined);
});

test("describes favorites for Maia", () => {
  assert.equal(
    describeFavorites([fav]),
    "- breakfast: Protein Overnight Oats (490 kcal, P 45 g, C 55 g, F 9 g): 1/2 cup oats",
  );
  assert.equal(describeFavorites([]), "none saved yet");
});

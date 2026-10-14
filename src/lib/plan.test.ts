import { test } from "node:test";
import assert from "node:assert/strict";
import { describeTotals, nextMonday, sumMeals, toggleDone, WeekPlanSchema } from "./plan.ts";

const meal = (calories: number, proteinG: number, carbsG: number, fatG: number) => ({
  slot: "lunch" as const,
  name: "Test",
  ingredients: [],
  calories,
  proteinG,
  carbsG,
  fatG,
});

test("sums meal macros", () => {
  assert.deepEqual(sumMeals([meal(500, 30, 50, 15), meal(700.4, 40.6, 60, 25)]), {
    calories: 1200,
    proteinG: 71,
    carbsG: 110,
    fatG: 40,
  });
});

test("describes daily differences from target", () => {
  const plan = WeekPlanSchema.parse({
    days: [{ date: "2026-10-19", meals: [meal(1800, 120, 200, 60)] }],
    shoppingList: [],
    prepTasks: [],
  });
  assert.equal(
    describeTotals(plan, { calories: 1825, proteinG: 122, carbsG: 197, fatG: 61 }),
    "2026-10-19: 1800 kcal (-25), P 120 g (-2), C 200 g (+3), F 60 g (-1)",
  );
});

test("rejects malformed plans", () => {
  assert.equal(WeekPlanSchema.safeParse({ days: [{ date: "Monday", meals: [] }] }).success, false);
});

test("next Monday", () => {
  assert.equal(nextMonday(new Date(2026, 9, 14)), "2026-10-19"); // Wednesday
  assert.equal(nextMonday(new Date(2026, 9, 18)), "2026-10-19"); // Sunday
  assert.equal(nextMonday(new Date(2026, 9, 19)), "2026-10-19"); // Monday itself
});

test("ticks and unticks one item in a list", () => {
  const plan = WeekPlanSchema.parse({
    days: [{ date: "2026-10-19", meals: [] }],
    shoppingList: [{ item: "Kvarg", quantity: "1 kg", category: "Dairy" }],
    prepTasks: [
      { task: "Cook rice", when: "Sunday" },
      { task: "Bake chicken", when: "Sunday" },
    ],
  });
  const ticked = toggleDone(plan, "prepTasks", 1);
  assert.deepEqual(ticked.prepTasks.map((t) => !!t.done), [false, true]);
  assert.equal(ticked.shoppingList[0].done, undefined); // other list untouched
  assert.equal(toggleDone(ticked, "prepTasks", 1).prepTasks[1].done, false);
  assert.equal(toggleDone(plan, "shoppingList", 0).shoppingList[0].done, true);
  assert.equal(plan.prepTasks[1].done, undefined); // original untouched
});

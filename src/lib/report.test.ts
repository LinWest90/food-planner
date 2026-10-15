import { test } from "node:test";
import assert from "node:assert/strict";
import type { FoodLog } from "./checkins.ts";
import type { Meal, WeekPlan } from "./plan.ts";
import { describeWeek, weekStats } from "./report.ts";

const meal = (slot: Meal["slot"], name: string, calories: number, proteinG: number): Meal => ({
  slot,
  name,
  ingredients: [],
  calories,
  proteinG,
  carbsG: 0,
  fatG: 0,
});

const plan: WeekPlan = {
  days: [
    { date: "2026-10-19", phase: "luteal", meals: [meal("breakfast", "Oats", 500, 30), meal("dinner", "Salmon", 900, 50)] },
    { date: "2026-10-20", meals: [meal("breakfast", "Oats", 500, 30), meal("dinner", "Tacos", 900, 40)] },
  ],
  shoppingList: [],
  prepTasks: [],
};
const target = { calories: 1400, proteinG: 80, carbsG: 150, fatG: 50 };

const log: FoodLog = {
  "2026-10-19": {
    checkIns: {
      0: { mealName: "Oats", status: "as-planned" },
      1: { mealName: "Salmon", status: "changed", ate: { name: "Pizza", calories: 1100, proteinG: 40, carbsG: 120, fatG: 45 } },
    },
    extras: [{ name: "Latte", calories: 150, proteinG: 8, carbsG: 15, fatG: 6 }],
  },
  "2026-10-20": { checkIns: { 0: { mealName: "Oats", status: "as-planned" } }, extras: [] },
};

test("week stats count check-ins and average fully logged days only", () => {
  const s = weekStats(plan, log, "2026-10-19", target);
  assert.equal(s.mealsPlanned, 4);
  assert.equal(s.mealsAnswered, 3);
  assert.equal(s.mealsAsPlanned, 2);
  assert.equal(s.daysFullyLogged, 1);
  assert.equal(s.avgCalories, 500 + 1100 + 150);
  assert.equal(s.avgProteinG, 30 + 40 + 8);
  assert.deepEqual(s.days[0].changes, ["Dinner: Pizza instead of Salmon", "Extra: Latte"]);
  assert.equal(s.days[1].eaten.calories, 500);
  assert.equal(s.days[1].planned.calories, 1400);
});

test("no averages without a fully logged day", () => {
  const s = weekStats(plan, {}, "2026-10-19", target);
  assert.equal(s.avgCalories, null);
  assert.match(describeWeek(s), /No fully logged days/);
});

test("description includes changes and phases", () => {
  const text = describeWeek(weekStats(plan, log, "2026-10-19", target));
  assert.match(text, /2026-10-19 \(luteal\): 1750 \/ 1400 kcal/);
  assert.match(text, /Pizza instead of Salmon/);
});

test("planned meals eaten with small tweaks count as planned, with their own macros", () => {
  const tweaked: FoodLog = {
    "2026-10-19": {
      checkIns: {
        0: { mealName: "Oats", status: "tweaked", ate: { name: "Oats (no honey)", calories: 450, proteinG: 30, carbsG: 0, fatG: 0 }, note: "no honey" },
        1: { mealName: "Salmon", status: "as-planned" },
      },
      extras: [],
    },
  };
  const s = weekStats(plan, tweaked, "2026-10-19", target);
  assert.equal(s.mealsAsPlanned, 2);
  assert.equal(s.days[0].eaten.calories, 450 + 900);
  assert.deepEqual(s.days[0].changes, ["Breakfast: Oats, with tweaks (no honey)"]);
});

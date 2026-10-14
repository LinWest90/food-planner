import { test } from "node:test";
import assert from "node:assert/strict";
import { dayProgress, dueMeals, weekProjection, type DayLog } from "./checkins.ts";
import type { Day, Meal } from "./plan.ts";

const meal = (slot: Meal["slot"], name: string, calories: number): Meal => ({
  slot,
  name,
  ingredients: [],
  calories,
  proteinG: 10,
  carbsG: 10,
  fatG: 10,
});

const day: Day = {
  date: "2026-10-19",
  meals: [meal("breakfast", "Oats", 400), meal("lunch", "Salad", 500), meal("dinner", "Salmon", 700)],
};

test("due meals depend on the time of day and skip answered ones", () => {
  const log: DayLog = { checkIns: { 0: { mealName: "Oats", status: "as-planned" } }, extras: [] };
  const due = dueMeals(day, log, new Date(2026, 9, 19, 14, 0));
  assert.deepEqual(due.map((d) => d.meal.name), ["Salad"]);
});

test("progress uses what was actually eaten", () => {
  const log: DayLog = {
    checkIns: {
      0: { mealName: "Oats", status: "as-planned" },
      1: { mealName: "Salad", status: "changed", ate: { name: "Burrito", calories: 900, proteinG: 40, carbsG: 100, fatG: 35 } },
    },
    extras: [{ name: "Latte", calories: 150, proteinG: 8, carbsG: 15, fatG: 6 }],
  };
  const p = dayProgress(day, log);
  assert.equal(p.answered, 2);
  assert.equal(p.eaten.calories, 400 + 900 + 150);
  assert.equal(p.projected.calories, 400 + 900 + 150 + 700);
  assert.equal(p.eaten.proteinG, 10 + 40 + 8);
});

test("answers for a meal that has since been replaced are ignored", () => {
  const log: DayLog = { checkIns: { 0: { mealName: "Pancakes", status: "as-planned" } }, extras: [] };
  assert.equal(dayProgress(day, log).answered, 0);
});

test("week projection sums every day", () => {
  const plan = { days: [day, { ...day, date: "2026-10-20" }], shoppingList: [], prepTasks: [] };
  assert.equal(weekProjection(plan, {}).calories, 3200);
});

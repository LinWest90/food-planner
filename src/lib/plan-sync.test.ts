import { test } from "node:test";
import assert from "node:assert/strict";
import type { FoodLog } from "./checkins.ts";
import type { Meal, WeekPlan } from "./plan.ts";
import { describeCheckIns, describePlanChanges, detachedCheckIns, planChanges } from "./plan-sync.ts";

const meal = (slot: Meal["slot"], name: string, calories: number): Meal => ({
  slot,
  name,
  ingredients: [],
  calories,
  proteinG: 10,
  carbsG: 10,
  fatG: 10,
});

const plan: WeekPlan = {
  days: [
    { date: "2026-10-19", meals: [meal("breakfast", "Oats", 400), meal("lunch", "Salad", 500), meal("dinner", "Salmon", 700)] },
    { date: "2026-10-20", meals: [meal("breakfast", "Eggs", 400)] },
  ],
  shoppingList: [],
  prepTasks: [],
};

const ate = { name: "Pizza", calories: 800, proteinG: 30, carbsG: 90, fatG: 30 };

test("check-ins are described per day, with what was eaten", () => {
  const log: FoodLog = {
    "2026-10-19": {
      checkIns: {
        0: { mealName: "Oats", status: "as-planned" },
        1: { mealName: "Salad", status: "tweaked", note: "no dressing", ate: { ...ate, name: "Salad (no dressing)", calories: 380 } },
        2: { mealName: "Old dinner", status: "changed", ate },
      },
      extras: [{ ...ate, name: "Latte", calories: 150 }],
    },
  };
  const text = describeCheckIns(plan, log)!;
  assert.match(text, /breakfast "Oats": eaten as planned/);
  assert.match(text, /eaten with tweaks \(no dressing\), logged as 380 kcal/);
  assert.match(text, /extra, not in the plan: Latte/);
  // The dinner check-in belongs to an older version of the plan, so it's ignored.
  assert.doesNotMatch(text, /Pizza/);
  assert.match(text, /Eaten so far: 930 kcal/);
  assert.match(text, /1 planned meal\(s\) not checked in yet; whole day if they go to plan: 1630 kcal/);
  assert.doesNotMatch(text, /2026-10-20/);
});

test("no check-ins means nothing to describe", () => {
  assert.equal(describeCheckIns(plan, {}), null);
});

test("plan changes list meals that differ from the saved plan", () => {
  const current: WeekPlan = structuredClone(plan);
  current.days[0].meals[2] = meal("dinner", "Salmon (smaller)", 550);
  const changes = planChanges(plan, current);
  assert.equal(changes.length, 1);
  assert.match(describePlanChanges(changes)!, /2026-10-19 dinner: "Salmon" → "Salmon \(smaller\)" \(550 kcal/);
  assert.equal(describePlanChanges(planChanges(plan, plan)), null);
});

test("a new plan that renames a checked-in meal is flagged", () => {
  const log: FoodLog = { "2026-10-19": { checkIns: { 0: { mealName: "Oats", status: "as-planned" } }, extras: [] } };
  const next: WeekPlan = structuredClone(plan);
  assert.deepEqual(detachedCheckIns(plan, next, log), []);
  next.days[0].meals[0] = meal("breakfast", "Yogurt bowl", 400);
  assert.deepEqual(detachedCheckIns(plan, next, log), ['2026-10-19 breakfast "Oats" (position 1 that day)']);
});

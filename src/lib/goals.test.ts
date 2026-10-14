import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateBmr, calculateGoals, DEFAULT_GOAL_INPUT } from "./goals.ts";

test("Mifflin-St Jeor BMR for a female", () => {
  // 10*68 + 6.25*168 - 5*30 - 161 = 680 + 1050 - 150 - 161 = 1419
  assert.equal(calculateBmr(DEFAULT_GOAL_INPUT), 1419);
});

test("deficit and macros add up to the calorie target", () => {
  const r = calculateGoals(DEFAULT_GOAL_INPUT);
  // TDEE = 1419 * 1.55 = 2199.45; -4kg over 12 weeks = -0.333 kg/week
  assert.equal(r.tdee, 2199);
  assert.equal(r.weeklyChangeKg, -0.33);
  assert.equal(r.dailyAdjustment, -367);
  assert.equal(r.calories, 1833);
  const macroKcal = r.proteinG * 4 + r.fatG * 9 + r.carbsG * 4;
  assert.ok(Math.abs(macroKcal - r.calories) < 10);
  assert.deepEqual(r.warnings, []);
});

test("warns about aggressive pace and very low calories", () => {
  const r = calculateGoals({ ...DEFAULT_GOAL_INPUT, targetWeightKg: 64, weeks: 4, activity: "sedentary" });
  assert.ok(r.warnings.some((w) => w.includes("1% of body weight")));
  assert.ok(r.warnings.some((w) => w.includes("kcal/day")));
});

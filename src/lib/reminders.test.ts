import { test } from "node:test";
import assert from "node:assert/strict";
import { dueReminders, localNow, reminderMessage } from "./reminders.ts";
import type { Day, Meal } from "./plan.ts";

const meal = (slot: Meal["slot"], name: string): Meal => ({ slot, name, ingredients: [], calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
const day: Day = { date: "2026-10-14", meals: [meal("breakfast", "Oats"), meal("lunch", "Salad"), meal("snack", "Kvarg"), meal("dinner", "Salmon")] };
const empty = { checkIns: {}, extras: [] };

test("local time in the user's time zone", () => {
  const now = new Date("2026-10-14T03:30:00Z");
  assert.deepEqual(localNow("America/Los_Angeles", now), { date: "2026-10-13", minutes: 20 * 60 + 30 });
  assert.deepEqual(localNow("Europe/Stockholm", now), { date: "2026-10-14", minutes: 5 * 60 + 30 });
  assert.deepEqual(localNow("Not/AZone", now), { date: "2026-10-14", minutes: 3 * 60 + 30 });
});

test("reminds after the check-in time, within the window, once", () => {
  // 13:10 local: breakfast (9:00) is 250 min ago, outside the 3 h window; lunch (13:00) is due.
  assert.deepEqual(dueReminders(day, empty, 13 * 60 + 10, new Set()).map((d) => d.meal.name), ["Salad"]);
  assert.deepEqual(dueReminders(day, empty, 13 * 60 + 10, new Set([1])), []);
  // 12:59: lunch isn't due yet and breakfast (9:00) is outside the window.
  assert.deepEqual(dueReminders(day, empty, 12 * 60 + 59, new Set()), []);
  // 11:30: breakfast is still within the window.
  assert.deepEqual(dueReminders(day, empty, 11 * 60 + 30, new Set()).map((d) => d.meal.name), ["Oats"]);
});

test("skips meals already checked in", () => {
  const log = { checkIns: { 1: { mealName: "Salad", status: "as-planned" as const } }, extras: [] };
  assert.deepEqual(dueReminders(day, log, 13 * 60 + 10, new Set()), []);
});

test("notification text", () => {
  assert.deepEqual(reminderMessage([{ meal: day.meals[1] }]), { title: "Did lunch happen as planned?", body: "Salad. Tap to check in." });
  assert.equal(reminderMessage([{ meal: day.meals[1] }, { meal: day.meals[2] }]).title, "2 meals to check in");
});

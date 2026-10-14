import { test } from "node:test";
import assert from "node:assert/strict";
import type { WeekPlan } from "./plan.ts";
import { planSpan, weekEnd, weekNeedingReport, weeksNeedingReports } from "./report.ts";

test("week end is six days after the start", () => {
  assert.equal(weekEnd("2026-10-26"), "2026-11-01");
});

const span = (weekStart: string) => ({ weekStart, last: weekEnd(weekStart) });

test("picks the newest finished, unreported week from the last two weeks", () => {
  const weeks = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"].map(span);
  // Today is Tue Oct 27: week of Oct 19 ended Sunday Oct 25.
  assert.equal(weekNeedingReport(weeks, [], "2026-10-27"), "2026-10-19");
  assert.equal(weekNeedingReport(weeks, ["2026-10-19"], "2026-10-27"), "2026-10-12");
  // Week of Oct 5 ended Oct 11, more than two weeks before Oct 27.
  assert.equal(weekNeedingReport(weeks, ["2026-10-19", "2026-10-12"], "2026-10-27"), null);
  // On the last day of a week it isn't finished yet.
  assert.equal(weekNeedingReport([span("2026-10-19")], [], "2026-10-25"), null);
});

test("lists every finished, unreported week from the last two weeks", () => {
  const weeks = ["2026-10-12", "2026-10-19", "2026-10-26"].map(span);
  assert.deepEqual(weeksNeedingReports(weeks, [], "2026-10-27"), ["2026-10-12", "2026-10-19"]);
  assert.deepEqual(weeksNeedingReports(weeks, ["2026-10-12"], "2026-10-27"), ["2026-10-19"]);
});

test("a plan's own dates decide its span, e.g. planned from a Wednesday", () => {
  const plan = {
    days: ["2026-10-16", "2026-10-14", "2026-10-15"].map((date) => ({ date, meals: [] })),
    shoppingList: [],
    prepTasks: [],
  } satisfies WeekPlan;
  assert.deepEqual(planSpan("2026-10-19", plan), { first: "2026-10-14", last: "2026-10-16" });
  assert.deepEqual(planSpan("2026-10-19", null), { first: "2026-10-19", last: "2026-10-25" });
  // That week is finished on Oct 17, even though its "week starting" date is Oct 19.
  assert.equal(weekNeedingReport([{ weekStart: "2026-10-19", ...planSpan("2026-10-19", plan) }], [], "2026-10-17"), "2026-10-19");
});

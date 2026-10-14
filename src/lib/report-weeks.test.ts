import { test } from "node:test";
import assert from "node:assert/strict";
import { weekEnd, weekNeedingReport } from "./report.ts";

test("week end is six days after the start", () => {
  assert.equal(weekEnd("2026-10-26"), "2026-11-01");
});

test("picks the newest finished, unreported week from the last two weeks", () => {
  const weeks = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"];
  // Today is Tue Oct 27: week of Oct 19 ended Sunday Oct 25.
  assert.equal(weekNeedingReport(weeks, [], "2026-10-27"), "2026-10-19");
  assert.equal(weekNeedingReport(weeks, ["2026-10-19"], "2026-10-27"), "2026-10-12");
  // Week of Oct 5 ended Oct 11, more than two weeks before Oct 27.
  assert.equal(weekNeedingReport(weeks, ["2026-10-19", "2026-10-12"], "2026-10-27"), null);
  // On the last day of a week it isn't finished yet.
  assert.equal(weekNeedingReport(["2026-10-19"], [], "2026-10-25"), null);
});

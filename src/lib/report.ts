// Weekly report numbers, computed from the plan and check-ins (never by the model).
import { EMPTY_DAY_LOG, checkInFor, countsAsPlanned, dayProgress, type FoodLog } from "./checkins.ts";
import type { CyclePhase } from "./cycle.ts";
import { sumMeals, toIsoDate, type Totals, type WeekPlan } from "./plan.ts";

export interface DayReport {
  date: string;
  phase?: CyclePhase;
  planned: Totals;
  /** What was eaten, from answered check-ins plus extras. */
  eaten: Totals;
  meals: number;
  answered: number;
  asPlanned: number;
  /** "Lunch: Burrito instead of Chicken salad", "Lunch: Chicken salad, with tweaks (no dressing)", etc. */
  changes: string[];
}

export interface WeekStats {
  weekStart: string;
  target: Totals;
  days: DayReport[];
  /** Days where every planned meal got a check-in. */
  daysFullyLogged: number;
  mealsPlanned: number;
  mealsAnswered: number;
  mealsAsPlanned: number;
  /** Averages over fully logged days; null when none are. */
  avgCalories: number | null;
  avgProteinG: number | null;
}

export function weekStats(plan: WeekPlan, log: FoodLog, weekStart: string, target: Totals): WeekStats {
  const days: DayReport[] = plan.days.map((day) => {
    const dayLog = log[day.date] ?? EMPTY_DAY_LOG;
    const progress = dayProgress(day, dayLog);
    let asPlanned = 0;
    const changes: string[] = [];
    day.meals.forEach((meal, i) => {
      const c = checkInFor(dayLog, i, meal);
      if (countsAsPlanned(c)) asPlanned++;
      if (c?.status === "tweaked") changes.push(`${capitalize(meal.slot)}: ${meal.name}, with tweaks (${c.note})`);
      if (c?.status === "changed") changes.push(`${capitalize(meal.slot)}: ${c.ate.name} instead of ${meal.name}`);
    });
    for (const extra of dayLog.extras) changes.push(`Extra: ${extra.name}`);
    return {
      date: day.date,
      phase: day.phase,
      planned: sumMeals(day.meals),
      eaten: progress.eaten,
      meals: day.meals.length,
      answered: progress.answered,
      asPlanned,
      changes,
    };
  });

  const full = days.filter((d) => d.meals > 0 && d.answered === d.meals);
  const avg = (pick: (t: Totals) => number) =>
    full.length ? Math.round(full.reduce((sum, d) => sum + pick(d.eaten), 0) / full.length) : null;

  return {
    weekStart,
    target,
    days,
    daysFullyLogged: full.length,
    mealsPlanned: days.reduce((n, d) => n + d.meals, 0),
    mealsAnswered: days.reduce((n, d) => n + d.answered, 0),
    mealsAsPlanned: days.reduce((n, d) => n + d.asPlanned, 0),
    avgCalories: avg((t) => t.calories),
    avgProteinG: avg((t) => t.proteinG),
  };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Plain-text summary of the numbers, for Maia to write the report from. */
export function describeWeek(stats: WeekStats): string {
  const t = stats.target;
  const lines = [
    `Week starting ${stats.weekStart}. Daily target: ${t.calories} kcal, protein ${t.proteinG} g, carbs ${t.carbsG} g, fat ${t.fatG} g.`,
    `Check-ins: ${stats.mealsAnswered} of ${stats.mealsPlanned} planned meals answered; ${stats.mealsAsPlanned} eaten as planned (including planned meals eaten with small tweaks). ${stats.daysFullyLogged} of ${stats.days.length} days fully logged.`,
    stats.avgCalories === null
      ? "No fully logged days, so no reliable daily averages."
      : `Average on fully logged days: ${stats.avgCalories} kcal and ${stats.avgProteinG} g protein.`,
    "",
    "Day by day (date, phase, eaten so far / planned, meals answered):",
    ...stats.days.map((d) => {
      const line = `${d.date}${d.phase ? ` (${d.phase})` : ""}: ${d.eaten.calories} / ${d.planned.calories} kcal, protein ${d.eaten.proteinG} / ${d.planned.proteinG} g, ${d.answered}/${d.meals} meals answered`;
      return d.changes.length ? `${line}. Changes: ${d.changes.join("; ")}` : line;
    }),
  ];
  return lines.join("\n");
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

export const weekEnd = (weekStart: string) => addDays(weekStart, 6);

/**
 * First and last day a week's plan covers. Usually the 7 days from its
 * "week starting" date, but a plan can start earlier or later (for example
 * when Maia is asked to start mid-week), so the plan's own dates win.
 */
export function planSpan(weekStart: string, plan: WeekPlan | null | undefined): { first: string; last: string } {
  const dates = (plan?.days ?? []).map((d) => d.date).sort();
  return dates.length ? { first: dates[0], last: dates[dates.length - 1] } : { first: weekStart, last: weekEnd(weekStart) };
}

export interface WeekSpan {
  weekStart: string;
  last: string;
}

/** Finished weeks (last day before today, within the last two weeks) without a report. */
export function weeksNeedingReports(weeks: WeekSpan[], reported: string[], today: string): string[] {
  const twoWeeksAgo = addDays(today, -14);
  return weeks
    .filter((w) => w.last < today && w.last >= twoWeeksAgo && !reported.includes(w.weekStart))
    .map((w) => w.weekStart)
    .sort();
}

/** The newest of those, if any: written when the app is opened after a week ends. */
export function weekNeedingReport(weeks: WeekSpan[], reported: string[], today: string): string | null {
  return weeksNeedingReports(weeks, reported, today).at(-1) ?? null;
}

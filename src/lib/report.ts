// Weekly report numbers, computed from the plan and check-ins (never by the model).
import { EMPTY_DAY_LOG, checkInFor, dayProgress, type FoodLog } from "./checkins.ts";
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
  /** "Lunch: had a burrito instead of Chicken salad", etc. */
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
      if (c?.status === "as-planned") asPlanned++;
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
    `Check-ins: ${stats.mealsAnswered} of ${stats.mealsPlanned} planned meals answered; ${stats.mealsAsPlanned} eaten as planned. ${stats.daysFullyLogged} of ${stats.days.length} days fully logged.`,
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

/** Finished weeks (ended before today, within the last two weeks) that have a plan but no report. */
export function weeksNeedingReports(weekStarts: string[], reported: string[], today: string): string[] {
  const twoWeeksAgo = addDays(today, -14);
  return weekStarts
    .filter((w) => weekEnd(w) < today && weekEnd(w) >= twoWeeksAgo && !reported.includes(w))
    .sort();
}

/** The newest of those, if any: written when the app is opened after a week ends. */
export function weekNeedingReport(weekStarts: string[], reported: string[], today: string): string | null {
  return weeksNeedingReports(weekStarts, reported, today).at(-1) ?? null;
}

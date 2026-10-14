// Meal check-ins: what actually got eaten compared with the plan.
import { sumMeals, type Day, type Meal, type Totals, type WeekPlan } from "./plan.ts";

export interface LoggedFood extends Totals {
  name: string;
}

export type CheckIn =
  | { mealName: string; status: "as-planned" }
  | { mealName: string; status: "changed"; ate: LoggedFood };

export interface DayLog {
  /** Keyed by the meal's index in the day's plan. */
  checkIns: Record<number, CheckIn>;
  /** Food eaten that wasn't in the plan. */
  extras: LoggedFood[];
}

export type FoodLog = Record<string, DayLog>;

export const EMPTY_DAY_LOG: DayLog = { checkIns: {}, extras: [] };

/** When to start asking about each meal, as [hour, minute]. */
export const CHECKIN_TIMES: Record<Meal["slot"], [number, number]> = {
  breakfast: [9, 0],
  lunch: [13, 0],
  snack: [16, 0],
  dinner: [19, 30],
};

/** The check-in for a meal, ignoring answers left over from an earlier version of the plan. */
export function checkInFor(log: DayLog, index: number, meal: Meal): CheckIn | undefined {
  const c = log.checkIns[index];
  return c && c.mealName === meal.name ? c : undefined;
}

/** Meals whose check-in time has passed but haven't been answered. */
export function dueMeals(day: Day, log: DayLog, now: Date): { index: number; meal: Meal }[] {
  const [y, m, d] = day.date.split("-").map(Number);
  return day.meals.flatMap((meal, index) => {
    const [hh, mm] = CHECKIN_TIMES[meal.slot];
    const due = new Date(y, m - 1, d, hh, mm) <= now;
    return due && !checkInFor(log, index, meal) ? [{ index, meal }] : [];
  });
}

export interface DayProgress {
  /** Answered meals plus extras. */
  eaten: Totals;
  /** Eaten so far plus the planned meals not answered yet. */
  projected: Totals;
  answered: number;
}

export function dayProgress(day: Day, log: DayLog): DayProgress {
  const eaten: Totals[] = [...log.extras];
  const upcoming: Totals[] = [];
  let answered = 0;
  day.meals.forEach((meal, index) => {
    const c = checkInFor(log, index, meal);
    if (!c) upcoming.push(meal);
    else {
      answered++;
      eaten.push(c.status === "as-planned" ? meal : c.ate);
    }
  });
  return { eaten: sumMeals(eaten), projected: sumMeals([...eaten, ...upcoming]), answered };
}

/** Projected totals for the whole planned week, using what was actually eaten where known. */
export function weekProjection(plan: WeekPlan, log: FoodLog): Totals {
  return sumMeals(plan.days.map((day) => dayProgress(day, log[day.date] ?? EMPTY_DAY_LOG).projected));
}

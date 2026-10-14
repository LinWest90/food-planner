// The week plan Maia writes, and the totals the app computes from it.
// Totals are always summed here, never taken from the model's own math.
import { z } from "zod";
import { CYCLE_PHASES } from "./cycle.ts";

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;

const Macros = {
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
};

export const MealSchema = z.object({
  slot: z.enum(MEAL_SLOTS),
  name: z.string().min(1),
  ingredients: z.array(z.object({ item: z.string(), quantity: z.string() })),
  ...Macros,
  /** Why this meal suits the day, e.g. its cycle phase. */
  why: z.string().optional(),
});

export const DaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phase: z.enum(CYCLE_PHASES).optional(),
  meals: z.array(MealSchema),
});

export const WeekPlanSchema = z.object({
  days: z.array(DaySchema).min(1).max(7),
  // `done` is ticked off in the app; Maia doesn't set it.
  shoppingList: z.array(
    z.object({ item: z.string(), quantity: z.string(), category: z.string(), done: z.boolean().optional() }),
  ),
  prepTasks: z.array(
    z.object({ task: z.string(), when: z.string(), done: z.boolean().optional() }),
  ),
  notes: z.string().optional(),
});

export type Meal = z.infer<typeof MealSchema>;
export type Day = z.infer<typeof DaySchema>;
export type WeekPlan = z.infer<typeof WeekPlanSchema>;

export interface Totals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export function sumMeals(meals: Totals[]): Totals {
  const t = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteinG: acc.proteinG + m.proteinG,
      carbsG: acc.carbsG + m.carbsG,
      fatG: acc.fatG + m.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  return {
    calories: Math.round(t.calories),
    proteinG: Math.round(t.proteinG),
    carbsG: Math.round(t.carbsG),
    fatG: Math.round(t.fatG),
  };
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** One line per day comparing planned totals with the targets, for Maia to check her plan. */
export function describeTotals(plan: WeekPlan, target: Totals): string {
  return plan.days
    .map((day) => {
      const t = sumMeals(day.meals);
      return (
        `${day.date}: ${t.calories} kcal (${signed(t.calories - target.calories)}), ` +
        `P ${t.proteinG} g (${signed(t.proteinG - target.proteinG)}), ` +
        `C ${t.carbsG} g (${signed(t.carbsG - target.carbsG)}), ` +
        `F ${t.fatG} g (${signed(t.fatG - target.fatG)})`
      );
    })
    .join("\n");
}

/** The Monday on or after `from`, as YYYY-MM-DD in local time. */
export function nextMonday(from: Date): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const offset = (8 - d.getDay()) % 7;
  d.setDate(d.getDate() + offset);
  return toIsoDate(d);
}

export function toIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** The plan with one prep task or shopping item ticked or unticked. */
export function toggleDone(plan: WeekPlan, list: "prepTasks" | "shoppingList", index: number): WeekPlan {
  return {
    ...plan,
    [list]: plan[list].map((t, i) => (i === index ? { ...t, done: !t.done } : t)),
  };
}

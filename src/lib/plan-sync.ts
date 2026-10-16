// Keeps the planning chat in step with check-ins: what she actually ate, and
// plan changes made on the check-in page since Maia last saved the week.
import { EMPTY_DAY_LOG, checkInFor, dayProgress, type FoodLog } from "./checkins.ts";
import type { Meal, Totals, WeekPlan } from "./plan.ts";

const macros = (t: Totals) =>
  `${Math.round(t.calories)} kcal, P ${Math.round(t.proteinG)} g, C ${Math.round(t.carbsG)} g, F ${Math.round(t.fatG)} g`;

/** Check-ins for the plan's days, one line per answered meal or extra. Null if nothing is logged. */
export function describeCheckIns(plan: WeekPlan, log: FoodLog): string | null {
  const days = plan.days.flatMap((day) => {
    const dayLog = log[day.date] ?? EMPTY_DAY_LOG;
    const lines = day.meals.flatMap((meal, index) => {
      const c = checkInFor(dayLog, index, meal);
      if (!c) return [];
      const label = `- ${meal.slot} "${meal.name}": `;
      if (c.status === "as-planned") return [`${label}eaten as planned`];
      if (c.status === "tweaked") return [`${label}eaten with tweaks (${c.note}), logged as ${macros(c.ate)}`];
      return [`${label}didn't happen; ate ${c.ate.name} instead (${macros(c.ate)})`];
    });
    lines.push(...dayLog.extras.map((x) => `- extra, not in the plan: ${x.name} (${macros(x)})`));
    if (!lines.length) return [];
    const progress = dayProgress(day, dayLog);
    const open = day.meals.length - progress.answered;
    return [
      `${day.date}:`,
      ...lines,
      `  Eaten so far: ${macros(progress.eaten)}. ${open ? `${open} planned meal(s) not checked in yet; whole day if they go to plan: ${Math.round(progress.projected.calories)} kcal.` : "All meals checked in."}`,
    ];
  });
  return days.length ? days.join("\n") : null;
}

/** Meals in `current` that differ from the plan Maia last saved (same date and position). */
export function planChanges(saved: WeekPlan, current: WeekPlan): { date: string; before: Meal | null; after: Meal }[] {
  const same = (a: Meal, b: Meal) =>
    a.name === b.name &&
    Math.round(a.calories) === Math.round(b.calories) &&
    Math.round(a.proteinG) === Math.round(b.proteinG) &&
    Math.round(a.carbsG) === Math.round(b.carbsG) &&
    Math.round(a.fatG) === Math.round(b.fatG);
  return current.days.flatMap((day) => {
    const before = saved.days.find((d) => d.date === day.date)?.meals ?? [];
    return day.meals.flatMap((after, i) =>
      before[i] && same(before[i], after) ? [] : [{ date: day.date, before: before[i] ?? null, after }],
    );
  });
}

export function describePlanChanges(changes: ReturnType<typeof planChanges>): string | null {
  if (!changes.length) return null;
  return changes
    .map(
      ({ date, before, after }) =>
        `- ${date} ${after.slot}: ${before ? `"${before.name}" → ` : ""}"${after.name}" (${macros(after)}; ${after.ingredients.map((g) => `${g.quantity} ${g.item}`).join(", ") || "no ingredients listed"})`,
    )
    .join("\n");
}

/**
 * Meals she already checked in on (against the saved plan) that a new plan
 * renames or moves, which would detach the check-in from its meal.
 */
export function detachedCheckIns(saved: WeekPlan, next: WeekPlan, log: FoodLog): string[] {
  return saved.days.flatMap((day) => {
    const dayLog = log[day.date] ?? EMPTY_DAY_LOG;
    const nextMeals = next.days.find((d) => d.date === day.date)?.meals ?? [];
    return day.meals.flatMap((meal, index) =>
      checkInFor(dayLog, index, meal) && nextMeals[index]?.name !== meal.name
        ? [`${day.date} ${meal.slot} "${meal.name}" (position ${index + 1} that day)`]
        : [],
    );
  });
}

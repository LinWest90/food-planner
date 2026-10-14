"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ReportCard, { formatDate } from "@/components/report-card";
import { PHASE_LABELS } from "@/lib/cycle";
import { fetchCoachView, type CoachView as CoachData } from "@/lib/data";
import { calculateGoals, DEFAULT_GOAL_INPUT } from "@/lib/goals";
import { toIsoDate } from "@/lib/plan";
import { weekEnd, weekStats } from "@/lib/report";
import { kgToLb, round1 } from "@/lib/units";

const LONG_DAY = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" });

/** The coach's read-only page, opened from the share link without signing in. */
export default function CoachView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<CoachData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState("");

  useEffect(() => {
    // "Today" is only known in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(toIsoDate(new Date()));
    fetchCoachView(token)
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [token]);

  if (error) return <p className="text-sm text-warn">⚠️ {error}</p>;
  if (data === undefined) return <p className="text-sm text-muted">Loading…</p>;
  if (data === null) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Link not active</h1>
        <p className="mt-2 text-sm text-muted">This coach link has been turned off or replaced. Ask for a new one.</p>
      </div>
    );
  }
  if (!data.goal) return <p className="text-sm text-muted">No goal has been set up yet.</p>;

  const goalInput = { ...DEFAULT_GOAL_INPUT, ...data.goal };
  const goal = calculateGoals(goalInput);
  const target = { calories: goal.calories, proteinG: goal.proteinG, carbsG: goal.carbsG, fatG: goal.fatG };

  // Every week with a plan or a report, newest first.
  const weekStarts = [...new Set([...data.weeks.map((w) => w.week_start), ...data.reports.map((r) => r.week_start)])]
    .sort()
    .reverse()
    .slice(0, 8);
  const latestPlan = data.weeks.find((w) => w.plan);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Weekly food overview</h1>
        <p className="mt-1 text-xs text-muted">Read-only view shared from Food Planner.</p>
      </div>

      <section className="rounded-xl bg-accent-soft p-4 text-sm">
        <p className="text-muted">Daily target</p>
        <p className="text-2xl font-semibold tabular-nums">{target.calories} kcal</p>
        <p className="tabular-nums">
          P {target.proteinG} g · C {target.carbsG} g · F {target.fatG} g
        </p>
        <p className="mt-2 text-xs text-muted tabular-nums">
          {round1(kgToLb(goalInput.weightKg))} lb → {round1(kgToLb(goalInput.targetWeightKg))} lb over {goalInput.weeks}{" "}
          weeks ({round1(kgToLb(goal.weeklyChangeKg))} lb/week). Estimated maintenance {goal.tdee} kcal.
        </p>
      </section>

      {weekStarts.map((weekStart) => {
        const week = data.weeks.find((w) => w.week_start === weekStart);
        const report = data.reports.find((r) => r.week_start === weekStart);
        const stats = week?.plan ? weekStats(week.plan, data.logs, weekStart, target) : report?.stats;
        if (!stats) return null;
        const current = today && weekStart <= today && today <= weekEnd(weekStart);
        return (
          <ReportCard
            key={weekStart}
            stats={stats}
            narrative={report?.narrative}
            title={current ? `This week (from ${formatDate(weekStart)})` : undefined}
          >
            {week && week.phases.length > 0 && (
              <p className="mt-3 text-xs text-muted">
                Cycle phases: {week.phases.map((p) => PHASE_LABELS[p]).join(" → ")} ·{" "}
                {week.mode === "prep" ? "Meal prep week" : "Cooking each meal"}
              </p>
            )}
          </ReportCard>
        );
      })}

      {latestPlan?.plan && (
        <section className="rounded-xl border border-line bg-surface p-4 text-sm">
          <h2 className="font-semibold">Meal plan, week of {formatDate(latestPlan.week_start)}</h2>
          <div className="mt-2 divide-y divide-line">
            {latestPlan.plan.days.map((day) => (
              <details key={day.date} className="py-2">
                <summary className="cursor-pointer font-medium">{formatDate(day.date, LONG_DAY)}</summary>
                <ul className="mt-2 space-y-2">
                  {day.meals.map((meal, i) => (
                    <li key={i}>
                      <p className="text-xs uppercase tracking-wide text-muted">{meal.slot}</p>
                      <p>{meal.name}</p>
                      <p className="text-xs text-muted tabular-nums">
                        {Math.round(meal.calories)} kcal · P {Math.round(meal.proteinG)} · C {Math.round(meal.carbsG)} · F{" "}
                        {Math.round(meal.fatG)}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReportCard from "@/components/report-card";
import type { FoodLog } from "@/lib/checkins";
import { fetchDayLogs, fetchGoalInput, fetchRecentWeeks, fetchReports, type PlanningSession, type SavedReport } from "@/lib/data";
import { calculateGoals } from "@/lib/goals";
import { toIsoDate, type Totals } from "@/lib/plan";
import { weekEnd, weekNeedingReport, weekStats } from "@/lib/report";
import { requestReport } from "@/lib/reports-client";
import CoachLink from "./coach-link";

interface Loaded {
  target: Totals;
  weeks: PlanningSession[];
  logs: FoodLog;
  reports: SavedReport[];
  today: string;
}

export default function Reports() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState<string | null>(null);

  const write = async (weekStart: string) => {
    setWriting(weekStart);
    setError(null);
    try {
      const report = await requestReport(weekStart);
      setData((d) => d && { ...d, reports: [report, ...d.reports.filter((r) => r.week_start !== weekStart)] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setWriting(null);
    }
  };

  useEffect(() => {
    (async () => {
      const today = toIsoDate(new Date());
      const [goal, weeks, reports] = await Promise.all([fetchGoalInput(), fetchRecentWeeks(), fetchReports()]);
      if (!goal) throw new Error("Set your goal first.");
      const g = calculateGoals(goal);
      const oldest = weeks.at(-1)?.weekStart;
      const logs = oldest ? await fetchDayLogs(oldest, weekEnd(weeks[0].weekStart)) : {};
      setData({
        target: { calories: g.calories, proteinG: g.proteinG, carbsG: g.carbsG, fatG: g.fatG },
        weeks,
        logs,
        reports,
        today,
      });
      // Write last week's report automatically if it's missing.
      const due = weekNeedingReport(
        weeks.map((w) => w.weekStart),
        reports.map((r) => r.week_start),
        today,
      );
      if (due) await write(due);
    })().catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Weekly reports</h1>
        <Link href="/" className="text-sm underline">
          Home
        </Link>
      </div>

      <CoachLink />

      {error && <p className="rounded-lg bg-accent-soft p-3 text-sm text-warn">⚠️ {error}</p>}
      {data && data.weeks.length === 0 && (
        <p className="text-sm text-muted">No planned weeks yet. Reports appear once you&apos;ve planned a week.</p>
      )}

      {data?.weeks.map((week) => {
        const report = data.reports.find((r) => r.week_start === week.weekStart);
        const finished = weekEnd(week.weekStart) < data.today;
        const started = week.weekStart <= data.today;
        const live = week.plan ? weekStats(week.plan, data.logs, week.weekStart, data.target) : null;
        const stats = report?.stats ?? live;
        if (!stats) return null;
        const isWriting = writing === week.weekStart;
        return (
          <ReportCard
            key={week.weekStart}
            stats={stats}
            narrative={report?.narrative}
            title={!finished && started ? "This week so far" : undefined}
          >
            {started && (
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  disabled={writing !== null}
                  onClick={() => write(week.weekStart)}
                  className="rounded-full border border-line px-4 py-1.5 text-sm disabled:opacity-50"
                >
                  {isWriting ? "Maia is writing…" : report ? "Rewrite with Maia" : "Write report with Maia"}
                </button>
                {report && (
                  <span className="text-xs text-muted">
                    Written {new Date(report.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            )}
          </ReportCard>
        );
      })}
    </div>
  );
}

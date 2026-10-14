"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CommentThread from "@/components/comment-thread";
import ReportCard from "@/components/report-card";
import type { FoodLog } from "@/lib/checkins";
import {
  addReply,
  deleteComment,
  fetchComments,
  fetchDayLogs,
  fetchGoalInput,
  fetchRecentWeeks,
  fetchReports,
  markCoachCommentsRead,
  type Comment,
  type PlanningSession,
  type SavedReport,
} from "@/lib/data";
import { calculateGoals } from "@/lib/goals";
import { toIsoDate, type Totals } from "@/lib/plan";
import { planSpan, weekNeedingReport, weekStats } from "@/lib/report";
import { requestReport } from "@/lib/reports-client";
import CoachLink from "./coach-link";

interface Loaded {
  target: Totals;
  weeks: PlanningSession[];
  logs: FoodLog;
  reports: SavedReport[];
  comments: Comment[];
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
      const [goal, weeks, reports, comments] = await Promise.all([
        fetchGoalInput(),
        fetchRecentWeeks(),
        fetchReports(),
        fetchComments(),
      ]);
      if (!goal) throw new Error("Set your goal first.");
      const g = calculateGoals(goal);
      const spans = weeks.map((w) => planSpan(w.weekStart, w.plan));
      const firsts = spans.map((x) => x.first).sort();
      const lasts = spans.map((x) => x.last).sort();
      const logs = spans.length ? await fetchDayLogs(firsts[0], lasts[lasts.length - 1]) : {};
      setData({
        target: { calories: g.calories, proteinG: g.proteinG, carbsG: g.carbsG, fatG: g.fatG },
        weeks,
        logs,
        reports,
        comments,
        today,
      });
      // They're on screen now (still marked "New" until the next visit).
      markCoachCommentsRead().catch(() => {});
      // Write last week's report automatically if it's missing.
      const due = weekNeedingReport(
        weeks.map((w, i) => ({ weekStart: w.weekStart, last: spans[i].last })),
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
        const span = planSpan(week.weekStart, week.plan);
        const finished = span.last < data.today;
        const started = span.first <= data.today;
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
            <CommentThread
              comments={data.comments.filter((c) => c.week_start === week.weekStart)}
              viewer="me"
              onAdd={async (body) => {
                try {
                  const added = await addReply(week.weekStart, body);
                  setData((d) => d && { ...d, comments: [...d.comments, added] });
                  return true;
                } catch (err) {
                  setError((err as Error).message);
                  return false;
                }
              }}
              onDelete={async (comment) => {
                try {
                  await deleteComment(comment.id);
                  setData((d) => d && { ...d, comments: d.comments.filter((c) => c.id !== comment.id) });
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            />
          </ReportCard>
        );
      })}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate } from "@/components/report-card";
import { fetchRecentWeeks, fetchReports } from "@/lib/data";
import { toIsoDate } from "@/lib/plan";
import { weekNeedingReport } from "@/lib/report";
import { requestReport } from "@/lib/reports-client";

/**
 * Writes last week's report in the background the first time the app is
 * opened after the week ends, then links to it.
 */
export default function ReportNudge() {
  const [state, setState] = useState<{ weekStart: string; done: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const [weeks, reports] = await Promise.all([fetchRecentWeeks(3), fetchReports()]);
      const due = weekNeedingReport(
        weeks.map((w) => w.weekStart),
        reports.map((r) => r.week_start),
        toIsoDate(new Date()),
      );
      if (!due) return;
      setState({ weekStart: due, done: false });
      await requestReport(due);
      setState({ weekStart: due, done: true });
    })().catch(() => setState(null));
  }, []);

  if (!state) return null;
  return (
    <Link href="/report" className="mt-3 block rounded-xl bg-accent-soft p-4 text-sm">
      {state.done
        ? `📋 Maia wrote your report for the week of ${formatDate(state.weekStart)} →`
        : `📋 Maia is writing your report for the week of ${formatDate(state.weekStart)}…`}
    </Link>
  );
}

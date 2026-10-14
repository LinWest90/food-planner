import { toIsoDate } from "@/lib/plan";
import { planSpan, weeksNeedingReports } from "@/lib/report";
import type { WeekPlan } from "@/lib/plan";
import { adminClient } from "@/lib/server-auth";
import { writeReport } from "@/lib/server/write-report";

// Several reports can be written in one run.
export const maxDuration = 300;

/**
 * Daily scheduled job (see vercel.json): writes any missing reports for
 * weeks that ended in the last two weeks, so reports appear even if the app
 * isn't opened. Safe to run more than once: weeks with a report are skipped.
 */
export async function GET(request: Request) {
  // Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = adminClient();
  if (!db || !process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Missing SUPABASE_SECRET_KEY or ANTHROPIC_API_KEY on the server." },
      { status: 500 },
    );
  }

  const today = toIsoDate(new Date());
  const [y, m, d] = today.split("-").map(Number);
  const since = toIsoDate(new Date(y, m - 1, d - 21));
  const [weeks, reports] = await Promise.all([
    db.from("week_plans").select("user_id, week_start, plan").not("plan", "is", null).gte("week_start", since),
    db.from("weekly_reports").select("user_id, week_start").gte("week_start", since),
  ]);
  if (weeks.error || reports.error) {
    return Response.json({ error: "Couldn't read the database." }, { status: 502 });
  }

  const results: { userId: string; weekStart: string; ok: boolean; error?: string }[] = [];
  const userIds = [...new Set(weeks.data.map((w) => w.user_id as string))];
  for (const userId of userIds) {
    const due = weeksNeedingReports(
      weeks.data
        .filter((w) => w.user_id === userId)
        .map((w) => ({ weekStart: w.week_start, last: planSpan(w.week_start, w.plan as WeekPlan).last })),
      reports.data.filter((r) => r.user_id === userId).map((r) => r.week_start),
      today,
    );
    for (const weekStart of due) {
      try {
        await writeReport(db, userId, weekStart);
        results.push({ userId, weekStart, ok: true });
      } catch (err) {
        results.push({ userId, weekStart, ok: false, error: (err as Error).message });
      }
    }
  }
  return Response.json({ today, written: results });
}

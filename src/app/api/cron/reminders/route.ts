import type { DayLog } from "@/lib/checkins";
import { EMPTY_DAY_LOG } from "@/lib/checkins";
import { WeekPlanSchema, type Day } from "@/lib/plan";
import { dueReminders, localNow, reminderMessage } from "@/lib/reminders";
import { adminClient } from "@/lib/server-auth";
import { configurePush, sendPush, type StoredSubscription } from "@/lib/server/push";

export const maxDuration = 60;

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Sends meal check-in reminders. Called every 10 minutes by a Supabase
 * pg_cron job (Vercel's free plan only allows daily schedules). Each meal
 * is reminded at most once, shortly after its check-in time.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = adminClient();
  if (!db || !configurePush()) {
    return Response.json({ error: "Missing SUPABASE_SECRET_KEY or VAPID keys on the server." }, { status: 500 });
  }

  const subs = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, time_zone, created_at")
    .order("created_at", { ascending: false });
  if (subs.error) return Response.json({ error: "Couldn't read subscriptions." }, { status: 502 });

  const byUser = new Map<string, (StoredSubscription & { time_zone: string })[]>();
  for (const s of subs.data) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  const now = new Date();
  const results: { userId: string; date: string; reminded: string[]; sent: number }[] = [];

  for (const [userId, devices] of byUser) {
    // The most recently added device's time zone wins.
    const { date, minutes } = localNow(devices[0].time_zone, now);

    const [weeks, log, sent] = await Promise.all([
      db
        .from("week_plans")
        .select("week_start, plan")
        .eq("user_id", userId)
        .gte("week_start", addDays(date, -13))
        .lte("week_start", addDays(date, 13))
        .order("week_start", { ascending: false }),
      db.from("day_logs").select("check_ins, extras").eq("user_id", userId).eq("date", date).maybeSingle(),
      db.from("reminders_sent").select("meal_index").eq("user_id", userId).eq("date", date),
    ]);
    if (weeks.error || log.error || sent.error) continue;

    let day: Day | undefined;
    for (const w of weeks.data) {
      const plan = WeekPlanSchema.safeParse(w.plan);
      day = plan.success ? plan.data.days.find((d) => d.date === date) : undefined;
      if (day) break;
    }
    if (!day) continue;

    const dayLog: DayLog = log.data ? { checkIns: log.data.check_ins, extras: log.data.extras } : EMPTY_DAY_LOG;
    const due = dueReminders(day, dayLog, minutes, new Set(sent.data.map((r) => r.meal_index)));
    if (due.length === 0) continue;

    // Record first (ignoring ones another run just recorded), so overlapping runs can't double-send.
    const claimed = await db
      .from("reminders_sent")
      .upsert(
        due.map((d) => ({ user_id: userId, date, meal_index: d.index })),
        { onConflict: "user_id,date,meal_index", ignoreDuplicates: true },
      )
      .select("meal_index");
    if (claimed.error) continue;
    const mine = due.filter((d) => claimed.data.some((c) => c.meal_index === d.index));
    if (mine.length === 0) continue;

    const message = { ...reminderMessage(mine), url: "/today", tag: `checkin-${date}` };
    let delivered = 0;
    let failed = 0;
    for (const device of devices) {
      const outcome = await sendPush(device, message);
      if (outcome === "sent") delivered++;
      if (outcome === "failed") failed++;
      if (outcome === "gone") await db.from("push_subscriptions").delete().eq("id", device.id);
    }
    // Nothing got through because of an error: un-mark them so the next run retries.
    if (delivered === 0 && failed > 0) {
      await db
        .from("reminders_sent")
        .delete()
        .eq("user_id", userId)
        .eq("date", date)
        .in("meal_index", mine.map((d) => d.index));
    }
    results.push({ userId, date, reminded: mine.map((d) => d.meal.name), sent: delivered });
  }

  return Response.json({ at: now.toISOString(), results });
}

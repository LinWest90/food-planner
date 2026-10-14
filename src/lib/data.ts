// Reads and writes the user's data in Supabase. Every query runs as the
// signed-in user; row level security keeps it to their own rows.
import type { DayLog, FoodLog } from "./checkins";
import type { CyclePhase } from "./cycle";
import { DEFAULT_GOAL_INPUT, type GoalInput } from "./goals";
import type { PlanningMode } from "./maia/prompt";
import { toIsoDate, type WeekPlan } from "./plan";
import type { ReportNarrative } from "./maia/report-prompt";
import type { WeekStats } from "./report";
import { supabase } from "./supabase";
import type Anthropic from "@anthropic-ai/sdk";

export interface PlanningSession {
  weekStart: string;
  phases: CyclePhase[];
  mode: PlanningMode;
  history: Anthropic.Beta.BetaMessageParam[];
  plan: WeekPlan | null;
}

interface WeekRow {
  week_start: string;
  phases: CyclePhase[];
  mode: PlanningMode;
  history: Anthropic.Beta.BetaMessageParam[];
  plan: WeekPlan | null;
}

const fromWeekRow = (r: WeekRow): PlanningSession => ({
  weekStart: r.week_start,
  phases: r.phases,
  mode: r.mode,
  history: r.history,
  plan: r.plan,
});

export async function userId(): Promise<string> {
  const { data } = await supabase().auth.getSession();
  if (!data.session) throw new Error("Not signed in.");
  return data.session.user.id;
}

export function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error?.message.includes("schema cache")) {
    throw new Error(
      "Some database tables haven't been set up yet. Run the SQL files in supabase/migrations/ in the Supabase SQL editor (see README).",
    );
  }
  if (error) throw new Error(`Couldn't reach the database: ${error.message}`);
  return data;
}

export async function fetchGoalInput(): Promise<GoalInput | null> {
  const row = check(await supabase().from("profiles").select("goal_input").maybeSingle());
  return row ? { ...DEFAULT_GOAL_INPUT, ...row.goal_input } : null;
}

export async function saveGoalInput(input: GoalInput): Promise<void> {
  check(await supabase().from("profiles").upsert({ user_id: await userId(), goal_input: input }));
}

export async function fetchWeek(weekStart: string): Promise<PlanningSession | null> {
  const row = check(
    await supabase().from("week_plans").select("*").eq("week_start", weekStart).maybeSingle<WeekRow>(),
  );
  return row ? fromWeekRow(row) : null;
}

/**
 * The plan covering `date`. Matches on the plan's own day dates, since a plan
 * can start on another day than its "week starting" date (for example when
 * Maia is asked to start today). Falls back to a week starting in the 7 days
 * up to `date`, for weeks that don't have a plan yet.
 */
export async function fetchWeekContaining(date: string): Promise<PlanningSession | null> {
  const rows = check(
    await supabase()
      .from("week_plans")
      .select("*")
      .gte("week_start", addDays(date, -13))
      .lte("week_start", addDays(date, 13))
      .order("week_start", { ascending: false })
      .returns<WeekRow[]>(),
  );
  const weeks = (rows ?? []).map(fromWeekRow);
  return (
    weeks.find((w) => w.plan?.days.some((d) => d.date === date)) ??
    weeks.find((w) => w.weekStart <= date && date <= addDays(w.weekStart, 6)) ??
    null
  );
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

export async function saveWeek(s: PlanningSession): Promise<void> {
  check(
    await supabase().from("week_plans").upsert({
      user_id: await userId(),
      week_start: s.weekStart,
      phases: s.phases,
      mode: s.mode,
      history: s.history,
      plan: s.plan,
    }),
  );
}

export async function fetchDayLogs(from: string, to: string): Promise<FoodLog> {
  const rows = check(
    await supabase()
      .from("day_logs")
      .select("date, check_ins, extras")
      .gte("date", from)
      .lte("date", to)
      .returns<{ date: string; check_ins: DayLog["checkIns"]; extras: DayLog["extras"] }[]>(),
  );
  return Object.fromEntries((rows ?? []).map((r) => [r.date, { checkIns: r.check_ins, extras: r.extras }]));
}

export async function saveDayLog(date: string, log: DayLog): Promise<void> {
  check(
    await supabase()
      .from("day_logs")
      .upsert({ user_id: await userId(), date, check_ins: log.checkIns, extras: log.extras }),
  );
}

export interface SavedReport {
  week_start: string;
  stats: WeekStats;
  narrative: ReportNarrative;
  updated_at: string;
}

export async function fetchReports(): Promise<SavedReport[]> {
  return (
    check(
      await supabase()
        .from("weekly_reports")
        .select("week_start, stats, narrative, updated_at")
        .order("week_start", { ascending: false })
        .limit(12)
        .returns<SavedReport[]>(),
    ) ?? []
  );
}

/** Weeks that have a plan, newest first. */
export async function fetchRecentWeeks(limit = 6): Promise<PlanningSession[]> {
  const rows = check(
    await supabase()
      .from("week_plans")
      .select("*")
      .not("plan", "is", null)
      .order("week_start", { ascending: false })
      .limit(limit)
      .returns<WeekRow[]>(),
  );
  return (rows ?? []).map(fromWeekRow);
}

export async function fetchCoachToken(): Promise<string | null> {
  const row = check(await supabase().from("coach_shares").select("token").maybeSingle());
  return row?.token ?? null;
}

/** Creates the coach link, or replaces it (the old link stops working). */
export async function createCoachToken(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  check(await supabase().from("coach_shares").upsert({ user_id: await userId(), token }));
  return token;
}

export async function deleteCoachToken(): Promise<void> {
  check(await supabase().from("coach_shares").delete().eq("user_id", await userId()));
}

export interface Comment {
  id: number;
  week_start: string;
  author: "coach" | "me";
  author_name: string | null;
  body: string;
  created_at: string;
  read_at?: string | null;
}

export async function fetchComments(): Promise<Comment[]> {
  return (
    check(
      await supabase()
        .from("coach_comments")
        .select("id, week_start, author, author_name, body, created_at, read_at")
        .order("created_at")
        .returns<Comment[]>(),
    ) ?? []
  );
}

export async function addReply(weekStart: string, body: string): Promise<Comment> {
  const added = check(
    await supabase()
      .from("coach_comments")
      .insert({ user_id: await userId(), week_start: weekStart, author: "me", body })
      .select("id, week_start, author, author_name, body, created_at, read_at")
      .single<Comment>(),
  );
  if (!added) throw new Error("Couldn't save the reply.");
  return added;
}

export async function deleteComment(id: number): Promise<void> {
  check(await supabase().from("coach_comments").delete().eq("id", id));
}

/** Coach comments not seen yet. */
export async function countUnreadCoachComments(): Promise<number> {
  const { count, error } = await supabase()
    .from("coach_comments")
    .select("id", { count: "exact", head: true })
    .eq("author", "coach")
    .is("read_at", null);
  if (error) throw new Error(`Couldn't reach the database: ${error.message}`);
  return count ?? 0;
}

export async function markCoachCommentsRead(): Promise<void> {
  check(
    await supabase()
      .from("coach_comments")
      .update({ read_at: new Date().toISOString() })
      .eq("author", "coach")
      .is("read_at", null),
  );
}

/** Adds a comment as the coach, through the share link. */
export async function addCoachComment(token: string, weekStart: string, body: string, name: string): Promise<Comment> {
  const added = check(
    await supabase().rpc("coach_add_comment", {
      p_token: token,
      p_week_start: weekStart,
      p_body: body,
      p_name: name,
    }),
  ) as Comment | null;
  if (!added) throw new Error("This link isn't active any more.");
  return added;
}

export interface CoachView {
  goal: GoalInput | null;
  weeks: { week_start: string; phases: CyclePhase[]; mode: PlanningMode; plan: WeekPlan | null }[];
  logs: FoodLog;
  reports: SavedReport[];
  comments: Comment[];
}

/** The coach's read-only view, by share token. Works without signing in. */
export async function fetchCoachView(token: string): Promise<CoachView | null> {
  return check(await supabase().rpc("coach_view", { p_token: token })) as CoachView | null;
}

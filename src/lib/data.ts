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

async function userId(): Promise<string> {
  const { data } = await supabase().auth.getSession();
  if (!data.session) throw new Error("Not signed in.");
  return data.session.user.id;
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
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

/** The most recent plan starting within the 7 days up to `date`. */
export async function fetchWeekContaining(date: string): Promise<PlanningSession | null> {
  const [y, m, d] = date.split("-").map(Number);
  const earliest = toIsoDate(new Date(y, m - 1, d - 6));
  const rows = check(
    await supabase()
      .from("week_plans")
      .select("*")
      .lte("week_start", date)
      .gte("week_start", earliest)
      .order("week_start", { ascending: false })
      .limit(1)
      .returns<WeekRow[]>(),
  );
  return rows?.[0] ? fromWeekRow(rows[0]) : null;
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

export interface CoachView {
  goal: GoalInput | null;
  weeks: { week_start: string; phases: CyclePhase[]; mode: PlanningMode; plan: WeekPlan | null }[];
  logs: FoodLog;
  reports: SavedReport[];
}

/** The coach's read-only view, by share token. Works without signing in. */
export async function fetchCoachView(token: string): Promise<CoachView | null> {
  return check(await supabase().rpc("coach_view", { p_token: token })) as CoachView | null;
}

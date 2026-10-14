// Reads and writes the user's data in Supabase. Every query runs as the
// signed-in user; row level security keeps it to their own rows.
import type { DayLog, FoodLog } from "./checkins";
import type { CyclePhase } from "./cycle";
import { DEFAULT_GOAL_INPUT, type GoalInput } from "./goals";
import type { PlanningMode } from "./maia/prompt";
import { toIsoDate, type WeekPlan } from "./plan";
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

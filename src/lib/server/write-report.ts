// Writes one week's report: numbers from the data, words from Maia, saved
// to weekly_reports. Used by /api/report (signed-in user) and by the daily
// scheduled job (admin client), so every query filters by user explicitly.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FoodLog } from "../checkins";
import { calculateGoals, DEFAULT_GOAL_INPUT } from "../goals";
import { describeMaiaError, fallbackParams, MAIA_MODEL } from "../maia/client";
import { REPORT_SYSTEM_PROMPT, ReportNarrativeSchema } from "../maia/report-prompt";
import { WeekPlanSchema } from "../plan";
import { describeWeek, planSpan, weekStats } from "../report";

export class ReportError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function writeReport(db: SupabaseClient, userId: string, weekStart: string) {
  const [profile, week] = await Promise.all([
    db.from("profiles").select("goal_input").eq("user_id", userId).maybeSingle(),
    db.from("week_plans").select("plan").eq("user_id", userId).eq("week_start", weekStart).maybeSingle(),
  ]);
  if (profile.error || week.error) throw new ReportError("Couldn't read your data. Please try again.", 502);
  const plan = WeekPlanSchema.safeParse(week.data?.plan);
  if (!profile.data || !plan.success) throw new ReportError("There's no plan for that week yet.", 404);

  const span = planSpan(weekStart, plan.data);
  const logs = await db
    .from("day_logs")
    .select("date, check_ins, extras")
    .eq("user_id", userId)
    .gte("date", span.first)
    .lte("date", span.last);
  if (logs.error) throw new ReportError("Couldn't read your data. Please try again.", 502);

  const goal = calculateGoals({ ...DEFAULT_GOAL_INPUT, ...profile.data.goal_input });
  const target = { calories: goal.calories, proteinG: goal.proteinG, carbsG: goal.carbsG, fatG: goal.fatG };
  const log: FoodLog = Object.fromEntries(
    (logs.data ?? []).map((r) => [r.date, { checkIns: r.check_ins, extras: r.extras }]),
  );
  const stats = weekStats(plan.data, log, weekStart, target);

  let narrative;
  try {
    const response = await new Anthropic().beta.messages.parse({
      model: MAIA_MODEL,
      max_tokens: 16000,
      ...fallbackParams(),
      output_config: { effort: "medium", format: betaZodOutputFormat(ReportNarrativeSchema) },
      system: REPORT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: describeWeek(stats) }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new ReportError("Maia couldn't write this report. Please try again.", 502);
    }
    narrative = response.parsed_output;
  } catch (err) {
    if (err instanceof ReportError) throw err;
    throw new ReportError(describeMaiaError(err, "Report request"), 502);
  }

  const saved = await db
    .from("weekly_reports")
    .upsert({ user_id: userId, week_start: weekStart, stats, narrative })
    .select("week_start, stats, narrative, updated_at")
    .single();
  if (saved.error) throw new ReportError("Couldn't save the report. Please try again.", 502);
  return saved.data;
}

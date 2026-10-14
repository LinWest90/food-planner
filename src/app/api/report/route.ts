import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { FoodLog } from "@/lib/checkins";
import { calculateGoals, DEFAULT_GOAL_INPUT } from "@/lib/goals";
import { fallbackParams, MAIA_MODEL, MISSING_KEY_ERROR } from "@/lib/maia/client";
import { REPORT_SYSTEM_PROMPT, ReportNarrativeSchema } from "@/lib/maia/report-prompt";
import { toIsoDate, WeekPlanSchema } from "@/lib/plan";
import { describeWeek, weekStats } from "@/lib/report";
import { bearerToken, requireUser, userClient } from "@/lib/server-auth";

export const maxDuration = 120;

const RequestSchema = z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/** Computes a week's numbers, has Maia write it up, and saves the report. */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: MISSING_KEY_ERROR }, { status: 500 });
  }
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { weekStart } = parsed.data;

  const db = userClient(bearerToken(request)!);
  const [y, m, d] = weekStart.split("-").map(Number);
  const weekEnd = toIsoDate(new Date(y, m - 1, d + 6));
  const [profile, week, logs] = await Promise.all([
    db.from("profiles").select("goal_input").maybeSingle(),
    db.from("week_plans").select("plan").eq("week_start", weekStart).maybeSingle(),
    db.from("day_logs").select("date, check_ins, extras").gte("date", weekStart).lte("date", weekEnd),
  ]);
  if (profile.error || week.error || logs.error) {
    return Response.json({ error: "Couldn't read your data. Please try again." }, { status: 502 });
  }
  const plan = WeekPlanSchema.safeParse(week.data?.plan);
  if (!profile.data || !plan.success) {
    return Response.json({ error: "There's no plan for that week yet." }, { status: 404 });
  }

  const goal = calculateGoals({ ...DEFAULT_GOAL_INPUT, ...profile.data.goal_input });
  const target = { calories: goal.calories, proteinG: goal.proteinG, carbsG: goal.carbsG, fatG: goal.fatG };
  const log: FoodLog = Object.fromEntries(
    (logs.data ?? []).map((r) => [r.date, { checkIns: r.check_ins, extras: r.extras }]),
  );
  const stats = weekStats(plan.data, log, weekStart, target);

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
      return Response.json({ error: "Maia couldn't write this report. Please try again." }, { status: 502 });
    }
    const narrative = response.parsed_output;

    const saved = await db
      .from("weekly_reports")
      .upsert({ user_id: user.id, week_start: weekStart, stats, narrative })
      .select("week_start, stats, narrative, updated_at")
      .single();
    if (saved.error) {
      return Response.json({ error: "Couldn't save the report. Please try again." }, { status: 502 });
    }
    return Response.json(saved.data);
  } catch (err) {
    console.error("Report request failed", err);
    const message =
      err instanceof Anthropic.AuthenticationError
        ? "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY."
        : err instanceof Anthropic.RateLimitError
          ? "Maia is busy (rate limited). Wait a minute and try again."
          : "Something went wrong talking to Maia. Please try again.";
    return Response.json({ error: message }, { status: 502 });
  }
}

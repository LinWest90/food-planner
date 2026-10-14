"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CheckInResult } from "@/app/api/checkin/route";
import {
  EMPTY_DAY_LOG,
  checkInFor,
  dayProgress,
  dueMeals,
  weekProjection,
  type DayLog,
  type FoodLog,
  type LoggedFood,
} from "@/lib/checkins";
import { PHASE_LABELS } from "@/lib/cycle";
import { calculateGoals } from "@/lib/goals";
import { toIsoDate, type Day, type Meal, type Totals } from "@/lib/plan";
import {
  loadFoodLog,
  loadGoalInput,
  loadPlanningSession,
  saveFoodLog,
  savePlanningSession,
  type PlanningSession,
} from "@/lib/storage";

const DATE_LABEL = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" });

function shiftDate(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

function parseDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const macroLine = (t: Totals) =>
  `${Math.round(t.calories)} kcal · P ${Math.round(t.proteinG)} · C ${Math.round(t.carbsG)} · F ${Math.round(t.fatG)}`;

interface Suggestion extends CheckInResult {
  applied?: boolean;
}

export default function Today() {
  const [state, setState] = useState<{
    target: Totals | null;
    session: PlanningSession | null;
    log: FoodLog;
    today: string;
  } | null>(null);
  const [date, setDate] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const goal = loadGoalInput();
    const today = toIsoDate(new Date());
    // Device storage and the current date are only available after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({
      target: goal ? calculateGoals(goal) : null,
      session: loadPlanningSession(),
      log: loadFoodLog(),
      today,
    });
    setDate(today);
  }, []);

  if (!state) return null;
  const { target, session, log, today } = state;

  if (!target) {
    return (
      <Link href="/goals" className="block rounded-xl bg-accent p-4 font-medium text-on-accent">
        Set your calorie and macro goal first →
      </Link>
    );
  }

  const plan = session?.plan ?? null;
  const day: Day = plan?.days.find((d) => d.date === date) ?? { date, meals: [] };
  const dayLog = log[date] ?? EMPTY_DAY_LOG;
  const progress = dayProgress(day, dayLog);
  const due = new Set(dueMeals(day, dayLog, new Date()).map((d) => d.index));

  const updateLog = (next: DayLog) => {
    const nextLog = { ...log, [date]: next };
    saveFoodLog(nextLog);
    setState({ ...state, log: nextLog });
  };

  const markAsPlanned = (index: number, meal: Meal) =>
    updateLog({ ...dayLog, checkIns: { ...dayLog.checkIns, [index]: { mealName: meal.name, status: "as-planned" } } });

  const clearCheckIn = (index: number) => {
    const checkIns = { ...dayLog.checkIns };
    delete checkIns[index];
    updateLog({ ...dayLog, checkIns });
  };

  const removeExtra = (i: number) => updateLog({ ...dayLog, extras: dayLog.extras.filter((_, j) => j !== i) });

  /** Asks Maia to estimate what was eaten and rebalance the rest of the week. Returns true on success. */
  async function logWithMaia(description: string, replaces: { index: number; meal: Meal } | null) {
    setBusy(true);
    setError(null);
    setSuggestion(null);
    try {
      const remaining = (plan?.days ?? [])
        .filter((d) => d.date >= date)
        .flatMap((d) => {
          const l = log[d.date] ?? EMPTY_DAY_LOG;
          return d.meals.flatMap((meal, index) =>
            checkInFor(l, index, meal) || (d.date === date && index === replaces?.index)
              ? []
              : [{ date: d.date, index, meal }],
          );
        })
        .slice(0, 40);

      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          description,
          replaces: replaces?.meal ?? null,
          target,
          eatenToday: progress.eaten,
          remaining,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      const result = body as CheckInResult;

      const ate: LoggedFood = result.ate;
      updateLog(
        replaces
          ? {
              ...dayLog,
              checkIns: {
                ...dayLog.checkIns,
                [replaces.index]: { mealName: replaces.meal.name, status: "changed", ate },
              },
            }
          : { ...dayLog, extras: [...dayLog.extras, ate] },
      );
      setSuggestion(result);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const applyAdjustments = () => {
    if (!session?.plan || !suggestion) return;
    const days = session.plan.days.map((d) => ({
      ...d,
      meals: d.meals.map((meal, index) => {
        const change = suggestion.adjustments.find((a) => a.date === d.date && a.index === index);
        return change ? { ...change.meal, why: meal.why } : meal;
      }),
    }));
    const nextSession = { ...session, plan: { ...session.plan, days } };
    savePlanningSession(nextSession);
    setState({ ...state, session: nextSession });
    setSuggestion({ ...suggestion, applied: true });
  };

  const week = plan ? weekProjection(plan, log) : null;
  const weekTarget = plan ? target.calories * plan.days.length : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{date === today ? "Today" : DATE_LABEL.format(parseDate(date))}</h1>
        <Link href="/" className="text-sm underline">
          Home
        </Link>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <button type="button" onClick={() => setDate(shiftDate(date, -1))} className="px-2 py-1" aria-label="Previous day">
          ‹ Prev
        </button>
        <span className="text-muted">
          {DATE_LABEL.format(parseDate(date))}
          {day.phase && ` · ${PHASE_LABELS[day.phase]}`}
        </span>
        <button type="button" onClick={() => setDate(shiftDate(date, 1))} className="px-2 py-1" aria-label="Next day">
          Next ›
        </button>
      </div>

      <section className="mt-4 rounded-xl bg-accent-soft p-4">
        <p className="text-sm text-muted">Eaten so far</p>
        <p className="text-3xl font-semibold tabular-nums">
          {progress.eaten.calories} <span className="text-base font-normal">/ {target.calories} kcal</span>
        </p>
        <p className="mt-1 text-sm tabular-nums">
          P {progress.eaten.proteinG}/{target.proteinG} g · C {progress.eaten.carbsG}/{target.carbsG} g · F{" "}
          {progress.eaten.fatG}/{target.fatG} g
        </p>
        {day.meals.length > 0 && (
          <p className="mt-2 text-xs text-muted tabular-nums">
            End of day if the rest goes to plan: {progress.projected.calories} kcal ({signed(progress.projected.calories - target.calories)})
          </p>
        )}
        {week && (
          <p className="mt-1 text-xs text-muted tabular-nums">
            Week on track for {week.calories} of {weekTarget} kcal ({signed(week.calories - weekTarget)})
          </p>
        )}
      </section>

      {suggestion && (
        <section className="mt-4 rounded-xl border border-accent bg-surface p-4 text-sm">
          <p className="font-medium">Maia</p>
          <p className="mt-1">{suggestion.message}</p>
          <p className="mt-2 text-xs text-muted">
            Logged: {suggestion.ate.name} · {macroLine(suggestion.ate)}
          </p>
          {suggestion.adjustments.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium">Suggested changes</p>
              <ul className="mt-1 space-y-1 text-xs">
                {suggestion.adjustments.map((a) => {
                  const before = plan?.days.find((d) => d.date === a.date)?.meals[a.index];
                  return (
                    <li key={`${a.date}/${a.index}`}>
                      {DATE_LABEL.format(parseDate(a.date))}, {a.meal.slot}: {before ? `${before.name} → ` : ""}
                      {a.meal.name} ({macroLine(a.meal)})
                    </li>
                  );
                })}
              </ul>
              {suggestion.applied ? (
                <p className="mt-2 text-xs text-accent">Plan updated ✓</p>
              ) : (
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={applyAdjustments} className="rounded-full bg-accent px-3 py-1.5 text-on-accent">
                    Update my plan
                  </button>
                  <button type="button" onClick={() => setSuggestion(null)} className="rounded-full border border-line px-3 py-1.5">
                    Keep plan as is
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
      {error && <p className="mt-4 rounded-lg bg-accent-soft p-3 text-sm text-warn">⚠️ {error}</p>}

      {day.meals.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No planned meals for this day.{" "}
          <Link href="/plan" className="underline">
            Plan your week with Maia
          </Link>
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {day.meals.map((meal, index) => (
            <MealCheckIn
              key={`${index}-${meal.name}`}
              meal={meal}
              checkIn={checkInFor(dayLog, index, meal)}
              due={due.has(index)}
              busy={busy}
              onYes={() => markAsPlanned(index, meal)}
              onNo={(text) => logWithMaia(text, { index, meal })}
              onUndo={() => clearCheckIn(index)}
            />
          ))}
        </ul>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Anything else?</h2>
        {dayLog.extras.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {dayLog.extras.map((x, i) => (
              <li key={i} className="flex justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                <span>
                  {x.name} <span className="text-xs text-muted">{macroLine(x)}</span>
                </span>
                <button type="button" onClick={() => removeExtra(i)} className="text-xs text-muted underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <DescribeFood
          placeholder="e.g. a latte and a handful of almonds"
          submitLabel="Log it"
          busy={busy}
          onSubmit={(text) => logWithMaia(text, null)}
        />
      </section>
    </div>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function MealCheckIn({
  meal,
  checkIn,
  due,
  busy,
  onYes,
  onNo,
  onUndo,
}: {
  meal: Meal;
  checkIn: ReturnType<typeof checkInFor>;
  due: boolean;
  busy: boolean;
  onYes: () => void;
  onNo: (description: string) => Promise<boolean>;
  onUndo: () => void;
}) {
  const [describing, setDescribing] = useState(false);

  return (
    <li className={`rounded-xl border bg-surface p-3 ${due ? "border-accent" : "border-line"}`}>
      <p className="text-xs uppercase tracking-wide text-muted">{meal.slot}</p>
      <p className="font-medium">{meal.name}</p>
      <p className="text-xs text-muted tabular-nums">{macroLine(meal)}</p>

      {checkIn ? (
        <div className="mt-2 flex items-start justify-between gap-2 text-sm">
          {checkIn.status === "as-planned" ? (
            <span>✅ Ate as planned</span>
          ) : (
            <span>
              ❌ Ate instead: {checkIn.ate.name}
              <span className="block text-xs text-muted tabular-nums">{macroLine(checkIn.ate)}</span>
            </span>
          )}
          <button type="button" onClick={onUndo} className="shrink-0 text-xs text-muted underline">
            Change
          </button>
        </div>
      ) : describing ? (
        <DescribeFood
          placeholder="What did you eat instead?"
          submitLabel="Tell Maia"
          busy={busy}
          onSubmit={async (text) => {
            const ok = await onNo(text);
            if (ok) setDescribing(false);
            return ok;
          }}
          onCancel={() => setDescribing(false)}
        />
      ) : (
        <div className="mt-2">
          <p className="text-sm">{due ? "Did this meal happen as planned?" : "Already eaten?"}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onYes} className="rounded-full bg-accent px-4 py-1.5 text-sm text-on-accent">
              Yes ✅
            </button>
            <button
              type="button"
              onClick={() => setDescribing(true)}
              className="rounded-full border border-line px-4 py-1.5 text-sm"
            >
              No ❌
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function DescribeFood({
  placeholder,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  submitLabel: string;
  busy: boolean;
  /** Resolve to false to keep the text (e.g. the request failed). */
  onSubmit: (text: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const value = text.trim();
        if (!value || busy) return;
        if (await onSubmit(value)) setText("");
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-background px-3 py-2 text-base"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-full bg-accent px-4 py-1.5 text-sm text-on-accent disabled:opacity-50"
        >
          {busy ? "Maia is logging…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-full border border-line px-4 py-1.5 text-sm">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

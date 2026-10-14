"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MaiaEvent } from "@/app/api/maia/route";
import { CYCLE_PHASES, PHASE_LABELS, type CyclePhase } from "@/lib/cycle";
import { calculateGoals, type GoalResult } from "@/lib/goals";
import { nextMonday, toIsoDate, toggleDone, type WeekPlan } from "@/lib/plan";
import {
  fetchGoalInput,
  fetchWeek,
  fetchWeekContaining,
  saveWeek,
  type PlanningSession,
} from "@/lib/data";
import { authHeaders } from "@/lib/supabase";
import ChatView from "./chat-view";
import PlanView from "./plan-view";

const TABS = ["Chat", "Plan", "Shopping", "Prep"] as const;
type Tab = (typeof TABS)[number];

function newSession(weekStart: string): PlanningSession {
  return { weekStart, phases: [], mode: "prep", history: [], plan: null };
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm ${
    active ? "border-accent bg-accent text-on-accent" : "border-line bg-surface"
  }`;

export default function Planner() {
  const [goal, setGoal] = useState<GoalResult | null | undefined>(undefined);
  // Placeholder until mount: "today" isn't known while prerendering.
  const [session, setSession] = useState<PlanningSession>(() => newSession(""));
  const [tab, setTab] = useState<Tab>("Chat");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Saves only follow the user's own changes, one at a time, in order.
  const dirty = useRef(false);
  const saves = useRef(Promise.resolve());

  useEffect(() => {
    (async () => {
      const today = new Date();
      const upcoming = nextMonday(today);
      const [input, current, next] = await Promise.all([
        fetchGoalInput(),
        fetchWeekContaining(toIsoDate(today)),
        fetchWeek(upcoming),
      ]);
      setGoal(input ? calculateGoals(input) : null);
      // On Sundays, default to planning the coming week.
      const isSunday = today.getDay() === 0;
      setSession((!isSunday && current) || next || current || newSession(upcoming));
    })().catch((err: Error) => {
      setError(err.message);
      setGoal(null);
    });
  }, []);

  useEffect(() => {
    if (!dirty.current) return;
    const snapshot = session;
    saves.current = saves.current.then(() =>
      saveWeek(snapshot).catch((err: Error) => setError(err.message)),
    );
  }, [session]);

  /** Applies a user change and saves it. */
  const change = (fn: (s: PlanningSession) => PlanningSession) => {
    dirty.current = true;
    setSession(fn);
  };

  const openWeek = async (weekStart: string) => {
    dirty.current = false;
    setError(null);
    try {
      setSession((await fetchWeek(weekStart)) ?? newSession(weekStart));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (goal === undefined) return null;
  if (goal === null) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Plan the week</h1>
        <Link href="/goals" className="mt-6 block rounded-xl bg-accent p-4 font-medium text-on-accent">
          Set your calorie and macro goal first →
        </Link>
        {error && <p className="mt-4 text-sm text-warn">⚠️ {error}</p>}
      </div>
    );
  }

  const target = {
    calories: goal.calories,
    proteinG: goal.proteinG,
    carbsG: goal.carbsG,
    fatG: goal.fatG,
  };
  const busy = streamingText !== null;

  const togglePhase = (phase: CyclePhase) =>
    change((s) => ({
      ...s,
      phases: s.phases.includes(phase) ? s.phases.filter((p) => p !== phase) : [...s.phases, phase],
    }));

  async function send(message: string) {
    setError(null);
    setStreamingText("");
    let text = "";
    try {
      const res = await fetch("/api/maia", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          history: session.history,
          message,
          context: {
            target,
            weekStart: session.weekStart,
            weekEnd: addDays(session.weekStart, 6),
            phases: session.phases,
            mode: session.mode,
          },
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let plan: WeekPlan | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as MaiaEvent;
          if (event.type === "text") {
            text += event.text;
            setStreamingText(text);
          } else if (event.type === "plan") {
            plan = event.plan;
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "done") {
            const newMessages = event.newMessages;
            change((s) => ({
              ...s,
              history: [...s.history, ...newMessages],
              plan: plan ?? s.plan,
            }));
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStreamingText(null);
    }
  }

  const startOver = () => {
    if (confirm("Start a new plan? This clears the chat and the current plan.")) {
      change((s) => ({ ...newSession(s.weekStart), phases: s.phases, mode: s.mode }));
      setTab("Chat");
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Plan the week</h1>
        <Link href="/" className="text-sm underline">
          Home
        </Link>
      </div>

      <section className="mt-4 space-y-4 rounded-xl border border-line bg-surface p-3">
        <label className="flex items-center justify-between text-sm font-medium">
          Week starting
          <input
            type="date"
            value={session.weekStart}
            onChange={(e) => e.target.value && openWeek(e.target.value)}
            disabled={busy}
            className="rounded-lg border border-line bg-background px-2 py-1"
          />
        </label>

        <div>
          <p className="text-sm font-medium">Cycle phases this week</p>
          <p className="text-xs text-muted">Tap in the order they&apos;ll happen.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CYCLE_PHASES.map((phase) => (
              <button
                key={phase}
                type="button"
                aria-pressed={session.phases.includes(phase)}
                onClick={() => togglePhase(phase)}
                className={chip(session.phases.includes(phase))}
              >
                {session.phases.includes(phase) && `${session.phases.indexOf(phase) + 1} · `}
                {PHASE_LABELS[phase]}
              </button>
            ))}
          </div>
          {session.phases.length > 0 && (
            <p className="mt-2 text-sm">{session.phases.map((p) => PHASE_LABELS[p]).join(" → ")}</p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium">This week I want to</p>
          <div className="mt-2 flex gap-2">
            {(
              [
                ["prep", "Meal prep"],
                ["daily", "Cook each meal"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={session.mode === mode}
                onClick={() => change((s) => ({ ...s, mode }))}
                className={chip(session.mode === mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <nav className="mt-4 grid grid-cols-4 gap-1 rounded-full bg-accent-soft p-1 text-sm">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full py-1.5 ${tab === t ? "bg-surface font-medium shadow-sm" : ""}`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="mt-4 flex flex-1 flex-col">
        {tab === "Chat" ? (
          <ChatView
            history={session.history}
            streamingText={streamingText}
            error={error}
            busy={busy}
            onSend={send}
          />
        ) : (
          <PlanView
            plan={session.plan}
            target={target}
            view={tab}
            onToggle={(list, i) => change((s) => (s.plan ? { ...s, plan: toggleDone(s.plan, list, i) } : s))}
          />
        )}
      </div>

      {session.history.length > 0 && (
        <button type="button" onClick={startOver} disabled={busy} className="mt-6 self-start text-xs text-muted underline">
          Start a new plan
        </button>
      )}
    </div>
  );
}

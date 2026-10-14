"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ACTIVITY_LEVELS,
  DEFAULT_GOAL_INPUT,
  calculateGoals,
  type ActivityLevel,
  type GoalInput,
} from "@/lib/goals";
import { loadGoalInput, saveGoalInput } from "@/lib/storage";

const inputClass =
  "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base";

function NumberField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className={inputClass}
      />
    </label>
  );
}

export default function GoalForm() {
  const [input, setInput] = useState<GoalInput>(DEFAULT_GOAL_INPUT);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = loadGoalInput();
    // Hydrate from device storage after mount; it isn't available on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setInput(stored);
  }, []);

  const set = <K extends keyof GoalInput>(key: K, value: GoalInput[K]) => {
    setSaved(false);
    setInput((prev) => ({ ...prev, [key]: value }));
  };

  const valid = [input.ageYears, input.heightCm, input.weightKg, input.targetWeightKg, input.weeks].every(
    (n) => Number.isFinite(n) && n > 0,
  );
  const result = valid ? calculateGoals(input) : null;

  return (
    <form
      className="mt-6 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        saveGoalInput(input);
        setSaved(true);
      }}
    >
      <fieldset className="grid grid-cols-2 gap-3">
        <label className="col-span-2 block text-sm font-medium">
          Sex (for the calorie formula)
          <select
            value={input.sex}
            onChange={(e) => set("sex", e.target.value as GoalInput["sex"])}
            className={inputClass}
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
        <NumberField label="Age" value={input.ageYears} onChange={(n) => set("ageYears", n)} />
        <NumberField label="Height (cm)" value={input.heightCm} onChange={(n) => set("heightCm", n)} />
        <NumberField label="Weight (kg)" value={input.weightKg} step={0.1} onChange={(n) => set("weightKg", n)} />
        <NumberField
          label="Goal weight (kg)"
          value={input.targetWeightKg}
          step={0.1}
          onChange={(n) => set("targetWeightKg", n)}
        />
        <NumberField label="Time frame (weeks)" value={input.weeks} onChange={(n) => set("weeks", n)} />
        <label className="col-span-2 block text-sm font-medium">
          Activity
          <select
            value={input.activity}
            onChange={(e) => set("activity", e.target.value as ActivityLevel)}
            className={inputClass}
          >
            {Object.entries(ACTIVITY_LEVELS).map(([key, a]) => (
              <option key={key} value={key}>
                {a.label}: {a.description}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <details className="rounded-lg border border-line p-3 text-sm">
        <summary className="cursor-pointer font-medium">Macro settings</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NumberField
            label="Protein (g per kg)"
            value={input.proteinPerKg}
            step={0.1}
            onChange={(n) => set("proteinPerKg", n)}
          />
          <NumberField
            label="Fat (% of kcal)"
            value={Math.round(input.fatShare * 100)}
            onChange={(n) => set("fatShare", n / 100)}
          />
        </div>
      </details>

      {result && (
        <section aria-live="polite" className="rounded-xl bg-accent-soft p-4">
          <p className="text-sm text-muted">Daily target</p>
          <p className="text-4xl font-semibold tabular-nums">
            {result.calories} <span className="text-lg font-normal">kcal</span>
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["Protein", result.proteinG],
              ["Carbs", result.carbsG],
              ["Fat", result.fatG],
            ].map(([label, grams]) => (
              <div key={label} className="rounded-lg bg-surface p-2">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{grams} g</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">
            Estimated maintenance {result.tdee} kcal ({result.dailyAdjustment > 0 ? "+" : ""}
            {result.dailyAdjustment} kcal/day for {result.weeklyChangeKg} kg/week). These are estimates;
            adjust with your coach based on real progress.
          </p>
          {result.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-warn">
              {result.warnings.map((w) => (
                <li key={w}>⚠️ {w}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!valid}
          className="rounded-full bg-accent px-5 py-3 font-medium text-on-accent disabled:opacity-50"
        >
          Save goal
        </button>
        {saved && (
          <Link href="/" className="text-sm underline">
            Saved ✓ Back to home
          </Link>
        )}
      </div>
    </form>
  );
}

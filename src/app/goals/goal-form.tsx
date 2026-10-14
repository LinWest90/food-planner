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
import { fetchGoalInput, saveGoalInput } from "@/lib/data";
import { KG_PER_LB, cmToFeetInches, feetInchesToCm, kgToLb, lbToKg, round1 } from "@/lib/units";

// The form is edited in US units; GoalInput (what's saved) is metric.
type FormState = Omit<GoalInput, "heightCm" | "weightKg" | "targetWeightKg"> & {
  heightFt: number;
  heightIn: number;
  weightLb: number;
  targetWeightLb: number;
};

function toFormState({ heightCm, weightKg, targetWeightKg, ...rest }: GoalInput): FormState {
  const { feet, inches } = cmToFeetInches(heightCm);
  return {
    ...rest,
    heightFt: feet,
    heightIn: inches,
    weightLb: round1(kgToLb(weightKg)),
    targetWeightLb: round1(kgToLb(targetWeightKg)),
  };
}

function toGoalInput({ heightFt, heightIn, weightLb, targetWeightLb, ...rest }: FormState): GoalInput {
  return {
    ...rest,
    heightCm: feetInchesToCm(heightFt, heightIn),
    weightKg: lbToKg(weightLb),
    targetWeightKg: lbToKg(targetWeightLb),
  };
}

const inputClass =
  "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base";

function NumberField({
  label,
  value,
  step = 1,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  hint?: string;
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
      {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

export default function GoalForm() {
  const [form, setForm] = useState<FormState>(() => toFormState(DEFAULT_GOAL_INPUT));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGoalInput()
      .then((stored) => stored && setForm(toFormState(stored)))
      .catch((err: Error) => setError(err.message));
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const valid =
    [form.ageYears, form.heightFt, form.weightLb, form.targetWeightLb, form.weeks].every(
      (n) => Number.isFinite(n) && n > 0,
    ) &&
    Number.isFinite(form.heightIn) &&
    form.heightIn >= 0;
  const input = toGoalInput(form);
  const result = valid ? calculateGoals(input) : null;

  return (
    <form
      className="mt-6 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        saveGoalInput(input)
          .then(() => setSaved(true))
          .catch((err: Error) => setError(err.message))
          .finally(() => setSaving(false));
      }}
    >
      <fieldset className="grid grid-cols-2 gap-3">
        <label className="col-span-2 block text-sm font-medium">
          Sex (for the calorie formula)
          <select
            value={form.sex}
            onChange={(e) => set("sex", e.target.value as GoalInput["sex"])}
            className={inputClass}
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
        <NumberField label="Age" value={form.ageYears} onChange={(n) => set("ageYears", n)} />
        <NumberField label="Time frame (weeks)" value={form.weeks} onChange={(n) => set("weeks", n)} />
        <NumberField label="Height (ft)" value={form.heightFt} onChange={(n) => set("heightFt", n)} />
        <NumberField label="Height (in)" value={form.heightIn} step={0.5} onChange={(n) => set("heightIn", n)} />
        <p className="col-span-2 -mt-1 text-xs text-muted">
          = {valid ? `${Math.round(input.heightCm)} cm` : "–"}
        </p>
        <NumberField
          label="Weight (lb)"
          value={form.weightLb}
          step={0.1}
          hint={Number.isFinite(input.weightKg) ? `= ${round1(input.weightKg)} kg` : undefined}
          onChange={(n) => set("weightLb", n)}
        />
        <NumberField
          label="Goal weight (lb)"
          value={form.targetWeightLb}
          step={0.1}
          hint={Number.isFinite(input.targetWeightKg) ? `= ${round1(input.targetWeightKg)} kg` : undefined}
          onChange={(n) => set("targetWeightLb", n)}
        />
        <label className="col-span-2 block text-sm font-medium">
          Activity
          <select
            value={form.activity}
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
            value={form.proteinPerKg}
            step={0.1}
            hint={Number.isFinite(form.proteinPerKg) ? `= ${round1(form.proteinPerKg * KG_PER_LB)} g per lb` : undefined}
            onChange={(n) => set("proteinPerKg", n)}
          />
          <NumberField
            label="Fat (% of kcal)"
            value={Math.round(form.fatShare * 100)}
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
            {result.dailyAdjustment} kcal/day for {round1(kgToLb(result.weeklyChangeKg))} lb /{" "}
            {result.weeklyChangeKg} kg per week). These are estimates;
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
          disabled={!valid || saving}
          className="rounded-full bg-accent px-5 py-3 font-medium text-on-accent disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save goal"}
        </button>
        {saved && (
          <Link href="/" className="text-sm underline">
            Saved ✓ Back to home
          </Link>
        )}
      </div>
      {error && <p className="text-sm text-warn">⚠️ {error}</p>}
    </form>
  );
}

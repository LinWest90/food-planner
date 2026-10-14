"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { calculateGoals, type GoalResult } from "@/lib/goals";
import { fetchGoalInput } from "@/lib/data";

export default function GoalSummary() {
  const [result, setResult] = useState<GoalResult | null | undefined>(undefined);

  useEffect(() => {
    fetchGoalInput()
      .then((input) => setResult(input ? calculateGoals(input) : null))
      .catch(() => setResult(null));
  }, []);

  if (result === undefined) return <div className="mt-6 h-28" />;

  if (result === null) {
    return (
      <Link
        href="/goals"
        className="mt-6 block rounded-xl bg-accent p-4 font-medium text-on-accent"
      >
        Start here: set your calorie and macro goal →
      </Link>
    );
  }

  return (
    <Link href="/goals" className="mt-6 block rounded-xl bg-accent-soft p-4">
      <p className="text-sm text-muted">Daily target</p>
      <p className="text-3xl font-semibold tabular-nums">{result.calories} kcal</p>
      <p className="mt-1 text-sm tabular-nums">
        P {result.proteinG} g · C {result.carbsG} g · F {result.fatG} g
      </p>
    </Link>
  );
}

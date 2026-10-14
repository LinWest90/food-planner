"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EMPTY_DAY_LOG, dueMeals } from "@/lib/checkins";
import { toIsoDate, type Meal } from "@/lib/plan";
import { loadFoodLog, loadPlanningSession } from "@/lib/storage";

/** Home-screen nudge for meals that are due a check-in today. */
export default function CheckInPrompt() {
  const [due, setDue] = useState<Meal[]>([]);

  useEffect(() => {
    const today = toIsoDate(new Date());
    const day = loadPlanningSession()?.plan?.days.find((d) => d.date === today);
    if (!day) return;
    const log = loadFoodLog()[today] ?? EMPTY_DAY_LOG;
    // Device storage and the current time are only available after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDue(dueMeals(day, log, new Date()).map((d) => d.meal));
  }, []);

  if (due.length === 0) return null;
  const latest = due[due.length - 1];
  return (
    <Link href="/today" className="mt-3 block rounded-xl bg-accent p-4 text-on-accent">
      <p className="font-medium">
        Did {latest.slot} happen as planned? ({latest.name})
      </p>
      <p className="mt-1 text-sm opacity-90">
        {due.length > 1 ? `${due.length} meals to check in · ` : ""}Tap to answer
      </p>
    </Link>
  );
}

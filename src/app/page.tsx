import Link from "next/link";
import GoalSummary from "./goal-summary";

const comingSoon = [
  "Meal check-ins: “Did this meal happen?”",
  "Favorites and recipe import",
  "Shopping and meal prep lists",
  "Coach share link and weekly reports",
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-2xl font-semibold">Food Planner</h1>
      <p className="mt-1 text-sm text-muted">Plan your week with Maia.</p>
      <GoalSummary />
      <Link
        href="/plan"
        className="mt-3 block rounded-xl border border-line bg-surface p-4 font-medium"
      >
        Plan the week with Maia →
      </Link>
      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted">Coming next</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {comingSoon.map((item) => (
            <li key={item} className="rounded-lg border border-line px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-8 text-xs text-muted">
        <Link href="/goals" className="underline">
          Edit goal
        </Link>
      </p>
    </main>
  );
}

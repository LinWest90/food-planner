import Link from "next/link";
import CheckInPrompt from "./checkin-prompt";
import GoalSummary from "./goal-summary";
import ReportNudge from "./report-nudge";
import SignOut from "./sign-out";

const comingSoon = [
  "Favorites and recipe import",
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-2xl font-semibold">Food Planner</h1>
      <p className="mt-1 text-sm text-muted">Plan your week with Maia.</p>
      <CheckInPrompt />
      <ReportNudge />
      <GoalSummary />
      <Link
        href="/today"
        className="mt-3 block rounded-xl border border-line bg-surface p-4 font-medium"
      >
        Today&apos;s meals and check-ins →
      </Link>
      <Link
        href="/plan"
        className="mt-3 block rounded-xl border border-line bg-surface p-4 font-medium"
      >
        Plan the week with Maia →
      </Link>
      <Link
        href="/report"
        className="mt-3 block rounded-xl border border-line bg-surface p-4 font-medium"
      >
        Weekly reports and coach link →
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
      <p className="mt-8 flex gap-4 text-xs text-muted">
        <Link href="/goals" className="underline">
          Edit goal
        </Link>
        <SignOut />
      </p>
    </main>
  );
}

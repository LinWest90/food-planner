import Link from "next/link";
import CheckInPrompt from "./checkin-prompt";
import GoalSummary from "./goal-summary";
import ReportNudge from "./report-nudge";
import SignOut from "./sign-out";

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
        href="/favorites"
        className="mt-3 block rounded-xl border border-line bg-surface p-4 font-medium"
      >
        ⭐ Favorite meals →
      </Link>
      <Link
        href="/report"
        className="mt-3 block rounded-xl border border-line bg-surface p-4 font-medium"
      >
        Weekly reports and coach link →
      </Link>
      <Link
        href="/notifications"
        className="mt-3 block rounded-xl border border-line bg-surface p-4 font-medium"
      >
        🔔 Meal reminders →
      </Link>
      <p className="mt-8 flex gap-4 text-xs text-muted">
        <Link href="/goals" className="underline">
          Edit goal
        </Link>
        <SignOut />
      </p>
    </main>
  );
}

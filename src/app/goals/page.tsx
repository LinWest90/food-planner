import type { Metadata } from "next";
import GoalForm from "./goal-form";

export const metadata: Metadata = { title: "Your goal" };

export default function GoalsPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-2xl font-semibold">Your goal</h1>
      <p className="mt-1 text-sm text-muted">
        Maia uses this to set your daily calories and macros.
      </p>
      <GoalForm />
    </main>
  );
}

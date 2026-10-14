import type { Metadata } from "next";
import Planner from "./planner";

export const metadata: Metadata = { title: "Plan the week" };

export default function PlanPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
      <Planner />
    </main>
  );
}

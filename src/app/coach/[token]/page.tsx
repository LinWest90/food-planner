import type { Metadata } from "next";
import { Suspense } from "react";
import CoachView from "./coach-view";

export const metadata: Metadata = {
  title: "Weekly food overview",
  // A private link: keep it out of search engines.
  robots: { index: false, follow: false },
};

export default function CoachPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <CoachView />
      </Suspense>
    </main>
  );
}

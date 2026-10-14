import type { Metadata } from "next";
import Reports from "./reports";

export const metadata: Metadata = { title: "Weekly reports" };

export default function ReportPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Reports />
    </main>
  );
}

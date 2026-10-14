import type { Metadata } from "next";
import Today from "./today";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Today />
    </main>
  );
}

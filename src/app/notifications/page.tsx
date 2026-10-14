import type { Metadata } from "next";
import Notifications from "./notifications";

export const metadata: Metadata = { title: "Reminders" };

export default function NotificationsPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Notifications />
    </main>
  );
}

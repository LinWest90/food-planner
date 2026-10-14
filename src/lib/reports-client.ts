// Browser helper for weekly reports.
import type { SavedReport } from "./data";
import { authHeaders } from "./supabase";

/** Asks Maia to write (or rewrite) the report for a week, and returns it once saved. */
export async function requestReport(weekStart: string): Promise<SavedReport> {
  const res = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ weekStart }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as SavedReport;
}

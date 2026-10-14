"use client";

import { useEffect, useState } from "react";
import { createCoachToken, deleteCoachToken, fetchCoachToken } from "@/lib/data";

/** Create, copy, share, replace or turn off the coach's read-only link. */
export default function CoachLink() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fetchCoachToken()
      .then(setToken)
      .catch((err: Error) => {
        setToken(null);
        setNote(err.message);
      });
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const url = token ? `${window.location.origin}/coach/${token}` : "";

  return (
    <section className="rounded-xl border border-line bg-surface p-4 text-sm">
      <h2 className="font-semibold">Coach link</h2>
      <p className="mt-1 text-xs text-muted">
        A private, read-only page your coach can open without an account. It shows your targets, plans, check-ins and
        weekly reports, but not your chats with Maia. Anyone with the link can see it, so only share it with your coach.
      </p>

      {token === undefined ? null : token === null ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(async () => setToken(await createCoachToken()))}
          className="mt-3 rounded-full bg-accent px-4 py-2 font-medium text-on-accent disabled:opacity-50"
        >
          Create coach link
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="truncate rounded-lg bg-background px-3 py-2 font-mono text-xs">{url}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                run(async () => {
                  if (navigator.share) await navigator.share({ title: "My food plan", url });
                  else {
                    await navigator.clipboard.writeText(url);
                    setNote("Link copied.");
                  }
                })
              }
              className="rounded-full bg-accent px-4 py-1.5 text-on-accent"
            >
              Share
            </button>
            <button
              type="button"
              onClick={() =>
                run(async () => {
                  await navigator.clipboard.writeText(url);
                  setNote("Link copied.");
                })
              }
              className="rounded-full border border-line px-4 py-1.5"
            >
              Copy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                confirm("Replace the link? The old one will stop working.") &&
                run(async () => {
                  setToken(await createCoachToken());
                  setNote("New link created. Send it to your coach again.");
                })
              }
              className="rounded-full border border-line px-4 py-1.5"
            >
              Replace
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                confirm("Turn off the coach link? It will stop working.") &&
                run(async () => {
                  await deleteCoachToken();
                  setToken(null);
                })
              }
              className="rounded-full border border-line px-4 py-1.5"
            >
              Turn off
            </button>
          </div>
        </div>
      )}
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CHECKIN_TIMES } from "@/lib/checkins";
import {
  currentSubscription,
  disableNotifications,
  enableNotifications,
  generateVapidKeys,
  pushSupport,
  sendTestNotification,
  VAPID_PUBLIC_KEY,
  type PushSupport,
} from "@/lib/push-client";

const time = ([h, m]: [number, number]) =>
  new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function Notifications() {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = pushSupport();
    // Browser features are only known after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(s);
    if (s === "ok") currentSubscription().then((sub) => setOn(!!sub));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Reminders</h1>
        <Link href="/" className="text-sm underline">
          Home
        </Link>
      </div>
      <p className="text-sm text-muted">
        Get a notification after each planned meal asking whether it happened as planned: breakfast at{" "}
        {time(CHECKIN_TIMES.breakfast)}, lunch at {time(CHECKIN_TIMES.lunch)}, snack at {time(CHECKIN_TIMES.snack)} and
        dinner at {time(CHECKIN_TIMES.dinner)} (your local time). Meals you&apos;ve already checked in are skipped.
      </p>

      {!VAPID_PUBLIC_KEY ? (
        <KeySetup />
      ) : support === "needs-home-screen" ? (
        <section className="rounded-xl border border-line bg-surface p-4 text-sm">
          <h2 className="font-semibold">Add the app to your home screen first</h2>
          <p className="mt-1">
            On iPhone, notifications only work from the home-screen app. In Safari, tap Share → <b>Add to Home Screen</b>,
            then open Food Planner from your home screen and come back here.
          </p>
        </section>
      ) : support === "unsupported" ? (
        <p className="rounded-lg bg-accent-soft p-3 text-sm">This browser doesn&apos;t support notifications.</p>
      ) : support === "ok" ? (
        <section className="rounded-xl border border-line bg-surface p-4 text-sm">
          <p className="font-semibold">{on ? "🔔 Reminders are on for this device" : "🔕 Reminders are off for this device"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {on ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await sendTestNotification();
                      setNote("Test sent. It should arrive in a few seconds.");
                    })
                  }
                  className="rounded-full bg-accent px-4 py-1.5 text-on-accent disabled:opacity-50"
                >
                  Send a test
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await disableNotifications();
                      setOn(false);
                    })
                  }
                  className="rounded-full border border-line px-4 py-1.5 disabled:opacity-50"
                >
                  Turn off
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await enableNotifications();
                    setOn(true);
                    setNote("Done. Tap “Send a test” to check it works.");
                  })
                }
                className="rounded-full bg-accent px-4 py-2 font-medium text-on-accent disabled:opacity-50"
              >
                Turn on reminders
              </button>
            )}
          </div>
          {note && <p className="mt-2 text-xs text-muted">{note}</p>}
        </section>
      ) : null}
      {error && <p className="rounded-lg bg-accent-soft p-3 text-sm text-warn">⚠️ {error}</p>}
    </div>
  );
}

/** One-time server setup: makes the notification keys on this device for pasting into Vercel. */
function KeySetup() {
  const [keys, setKeys] = useState<{ publicKey: string; privateKey: string } | null>(null);
  return (
    <section className="rounded-xl border border-line bg-surface p-4 text-sm">
      <h2 className="font-semibold">One-time setup</h2>
      <p className="mt-1">
        Notifications need a pair of keys on the server. Tap below to make them on this device (they aren&apos;t sent
        anywhere), then add them in Vercel → Settings → Environment Variables and redeploy.
      </p>
      {!keys ? (
        <button
          type="button"
          onClick={async () => setKeys(await generateVapidKeys())}
          className="mt-3 rounded-full bg-accent px-4 py-2 font-medium text-on-accent"
        >
          Make keys
        </button>
      ) : (
        <div className="mt-3 space-y-2 text-xs">
          <KeyRow name="NEXT_PUBLIC_VAPID_PUBLIC_KEY" value={keys.publicKey} />
          <KeyRow name="VAPID_PRIVATE_KEY" value={keys.privateKey} secret />
          <KeyRow name="VAPID_SUBJECT" value="mailto:you@example.com" hint="Use your own email after mailto:" />
        </div>
      )}
    </section>
  );
}

function KeyRow({ name, value, secret, hint }: { name: string; value: string; secret?: boolean; hint?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="font-semibold">
        {name} {secret && <span className="font-normal text-warn">(secret: only paste into Vercel)</span>}
      </p>
      <div className="mt-1 flex gap-2">
        <p className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 font-mono">{value}</p>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          }}
          className="shrink-0 rounded-full border border-line px-3"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {hint && <p className="mt-0.5 text-muted">{hint}</p>}
    </div>
  );
}

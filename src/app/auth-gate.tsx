"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/** Shows the sign-in screen until there's a session, then the app. */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // The coach's share page is public by design: the link itself is the key.
  const [isCoachPage, setIsCoachPage] = useState(false);

  useEffect(() => {
    // The address is only known in the browser (pages are prerendered).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCoachPage(window.location.pathname.startsWith("/coach/"));
    if (!isSupabaseConfigured) return;
    const auth = supabase().auth;
    auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6 text-sm">
        <h1 className="text-2xl font-semibold">Almost there</h1>
        <p className="mt-2">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to{" "}
          <code>.env.local</code> (see the README), then restart the app.
        </p>
      </main>
    );
  }
  if (isCoachPage) return <div className="flex flex-1 flex-col">{children}</div>;
  if (session === undefined) return null;
  if (session === null) return <SignIn />;
  // Remount the app when the signed-in user changes so nothing carries over.
  return <div key={session.user.id} className="flex flex-1 flex-col">{children}</div>;
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Food Planner</h1>
      <p className="mt-1 text-sm text-muted">Sign in to plan with Maia.</p>
      <form
        className="mt-6 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
          if (error) setError(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
          setBusy(false);
        }}
      >
        <label className="block text-sm font-medium">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base"
          />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base"
          />
        </label>
        {error && <p className="text-sm text-warn">⚠️ {error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-accent px-5 py-3 font-medium text-on-accent disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

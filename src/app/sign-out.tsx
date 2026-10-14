"use client";

import { supabase } from "@/lib/supabase";

export default function SignOut() {
  return (
    <button type="button" onClick={() => supabase().auth.signOut()} className="underline">
      Sign out
    </button>
  );
}

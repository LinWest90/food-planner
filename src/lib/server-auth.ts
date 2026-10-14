import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./supabase";

/**
 * Checks the request's Supabase access token. Returns the user, or a 401
 * response to send back. If ALLOWED_EMAILS is set (comma-separated), only
 * those accounts may use the API, so a stray sign-up can't spend API credit.
 */
export async function requireUser(request: Request): Promise<User | Response> {
  const token = bearerToken(request);
  if (!token) return Response.json({ error: "Please sign in again." }, { status: 401 });

  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: "Please sign in again." }, { status: 401 });

  const allowed = process.env.ALLOWED_EMAILS?.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (allowed?.length && !allowed.includes(data.user.email?.toLowerCase() ?? "")) {
    return Response.json({ error: "This account isn't allowed to use Maia." }, { status: 403 });
  }
  return data.user;
}

export function bearerToken(request: Request): string | undefined {
  return request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
}

/** A Supabase client acting as the signed-in user, so row level security still applies. */
export function userClient(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/**
 * A Supabase client with full access, bypassing row level security. Only
 * for the scheduled job, which has no signed-in user. Needs the project's
 * secret key (SUPABASE_SECRET_KEY, or the older SUPABASE_SERVICE_ROLE_KEY).
 */
export function adminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

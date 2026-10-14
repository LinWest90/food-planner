import { createClient, type User } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./supabase";

/**
 * Checks the request's Supabase access token. Returns the user, or a 401
 * response to send back. If ALLOWED_EMAILS is set (comma-separated), only
 * those accounts may use the API, so a stray sign-up can't spend API credit.
 */
export async function requireUser(request: Request): Promise<User | Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
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

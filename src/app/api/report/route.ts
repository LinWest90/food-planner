import { z } from "zod";
import { MISSING_KEY_ERROR } from "@/lib/maia/client";
import { bearerToken, requireUser, userClient } from "@/lib/server-auth";
import { ReportError, writeReport } from "@/lib/server/write-report";

export const maxDuration = 120;

const RequestSchema = z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/** Writes (or rewrites) the signed-in user's report for a week. */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: MISSING_KEY_ERROR }, { status: 500 });
  }
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });

  try {
    const report = await writeReport(userClient(bearerToken(request)!), user.id, parsed.data.weekStart);
    return Response.json(report);
  } catch (err) {
    const status = err instanceof ReportError ? err.status : 500;
    return Response.json({ error: (err as Error).message }, { status });
  }
}

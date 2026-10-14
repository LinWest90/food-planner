import { z } from "zod";
import { MISSING_KEY_ERROR } from "@/lib/maia/client";
import { MEAL_SLOTS } from "@/lib/plan";
import { requireUser } from "@/lib/server-auth";
import { draftFavorite, DraftError } from "@/lib/server/draft-favorite";

export const maxDuration = 120;

const RequestSchema = z.object({
  slot: z.enum(MEAL_SLOTS),
  description: z.string().max(4000),
  imageFileIds: z.array(z.string().regex(/^file_[A-Za-z0-9_-]+$/)).max(4).default([]),
});

/** Turns a description (and photos) into a favorite meal with estimated macros, for her to review and save. */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: MISSING_KEY_ERROR }, { status: 500 });
  }
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { slot, description, imageFileIds } = parsed.data;
  if (!description.trim() && imageFileIds.length === 0) {
    return Response.json({ error: "Describe the meal or add a photo." }, { status: 400 });
  }

  try {
    const text = description.trim()
      ? `Her description:\n"""${description.trim()}"""`
      : "No description; go by the photo.";
    return Response.json(await draftFavorite(slot, text, imageFileIds));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: err instanceof DraftError ? 502 : 500 });
  }
}

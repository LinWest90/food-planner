import Anthropic from "@anthropic-ai/sdk";
import { MISSING_KEY_ERROR } from "@/lib/maia/client";
import { requireUser } from "@/lib/server-auth";

export const maxDuration = 60;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Stores a photo with Anthropic's Files API and returns its file id. The
 * chat history then refers to the photo by id instead of carrying the
 * image itself on every request.
 */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: MISSING_KEY_ERROR }, { status: 500 });
  }
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !IMAGE_TYPES.includes(file.type)) {
    return Response.json({ error: "Please choose a photo (JPEG, PNG, WebP or GIF)." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "That photo is too large (over 5 MB)." }, { status: 400 });
  }

  try {
    const uploaded = await new Anthropic().files.upload({ file });
    return Response.json({ fileId: uploaded.id });
  } catch (err) {
    console.error("Photo upload failed", err);
    return Response.json({ error: "Couldn't upload the photo. Please try again." }, { status: 502 });
  }
}

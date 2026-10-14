/** Uploads one photo for Maia (via /api/maia/upload) and returns its Files API id. */
export async function uploadPhoto(photo: Blob, auth: Record<string, string>): Promise<string> {
  const form = new FormData();
  form.append("file", photo, "photo.jpg");
  const res = await fetch("/api/maia/upload", { method: "POST", headers: auth, body: form });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.fileId) throw new Error(body?.error ?? `Photo upload failed (${res.status})`);
  return body.fileId;
}

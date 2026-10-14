import { bearerToken, requireUser, userClient } from "@/lib/server-auth";
import { configurePush, sendPush, type StoredSubscription } from "@/lib/server/push";

/** Sends a test notification to the signed-in user's devices. */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (!configurePush()) {
    return Response.json({ error: "Notifications aren't set up on the server yet (VAPID keys missing)." }, { status: 500 });
  }
  const db = userClient(bearerToken(request)!);
  const subs = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").returns<StoredSubscription[]>();
  if (subs.error) return Response.json({ error: "Couldn't read your devices." }, { status: 502 });
  if (subs.data.length === 0) return Response.json({ error: "No devices have notifications turned on." }, { status: 404 });

  let sent = 0;
  for (const sub of subs.data) {
    const outcome = await sendPush(sub, {
      title: "Reminders are on 🎉",
      body: "Maia will check in after each meal.",
      url: "/today",
      tag: "test",
    });
    if (outcome === "sent") sent++;
    if (outcome === "gone") await db.from("push_subscriptions").delete().eq("id", sub.id);
  }
  return sent > 0
    ? Response.json({ sent })
    : Response.json({ error: "Couldn't deliver to any device. Try turning notifications off and on again." }, { status: 502 });
}

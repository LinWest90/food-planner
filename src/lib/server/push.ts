// Sends Web Push notifications (VAPID). Keys come from the environment:
// NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.
import webpush, { WebPushError } from "web-push";

export interface StoredSubscription {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Page to open when the notification is tapped. */
  url: string;
  /** Notifications with the same tag replace each other. */
  tag?: string;
}

let configured = false;

/** Returns false if the VAPID keys aren't set. */
export function configurePush(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/** "sent", "gone" (the device unsubscribed; delete it) or "failed". */
export async function sendPush(sub: StoredSubscription, message: PushMessage): Promise<"sent" | "gone" | "failed"> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(message),
      { TTL: 60 * 60, urgency: "normal" },
    );
    return "sent";
  } catch (err) {
    if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) return "gone";
    console.error("Push failed", err instanceof WebPushError ? `${err.statusCode} ${err.body}` : err);
    return "failed";
  }
}

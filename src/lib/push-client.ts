// Browser side of phone notifications.
import { supabase, authHeaders } from "./supabase";

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushSupport = "ok" | "needs-home-screen" | "unsupported";

/** Whether this browser can get notifications. iPhones need the app added to the home screen first. */
export function pushSupport(): PushSupport {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "needs-home-screen";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return "ok";
}

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const bytesToBase64Url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function registration() {
  return navigator.serviceWorker.register("/sw.js");
}

/** This device's current subscription, if notifications are on. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Asks for permission (must be called from a tap) and saves this device. */
export async function enableNotifications(): Promise<void> {
  if (!VAPID_PUBLIC_KEY) throw new Error("Notifications aren't set up yet (missing key).");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications are blocked. Allow them in Settings → Notifications → Food Planner, then try again.");
  }
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub: PushSubscription;
  try {
    sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) }));
  } catch (err) {
    throw new Error(
      `This device couldn't sign up for notifications (${(err as Error).message}). Check that notifications are allowed for Food Planner, then try again.`,
    );
  }
  const json = sub.toJSON();
  const { data } = await supabase().auth.getSession();
  const { error } = await supabase()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: data.session?.user.id,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      { onConflict: "endpoint" },
    );
  if (error) throw new Error(`Couldn't save this device: ${error.message}`);
}

export async function disableNotifications(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export async function sendTestNotification(): Promise<void> {
  const res = await fetch("/api/push/test", { method: "POST", headers: await authHeaders() });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
}

/**
 * Makes a new VAPID key pair in the browser (Web Crypto), for setting up
 * the server. Nothing is sent anywhere; the keys are only shown on screen.
 */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicKey = bytesToBase64Url(await crypto.subtle.exportKey("raw", pair.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicKey, privateKey: jwk.d! };
}

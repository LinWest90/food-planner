"use client";

import type Anthropic from "@anthropic-ai/sdk";
import { useState } from "react";
import AutoGrowTextarea from "@/components/auto-grow-textarea";
import { AddPhotoButton, PhotoPreviews, usePhotos } from "@/components/photo-picker";
import RichText from "@/components/rich-text";

const MAX_PHOTOS = 4;

interface Bubble {
  role: "user" | "assistant";
  text: string;
  /** Number of photos sent with a user message (history keeps only file ids). */
  photoCount?: number;
  /** Local previews, only for the message being sent right now. */
  previews?: string[];
}

/** Turns the raw API history into chat bubbles, skipping the context block and tool traffic. */
function toBubbles(history: Anthropic.Beta.BetaMessageParam[]): Bubble[] {
  const bubbles: Bubble[] = [];
  for (const msg of history) {
    if (msg.role === "system") continue;
    if (typeof msg.content === "string") {
      bubbles.push({ role: msg.role, text: msg.content });
      continue;
    }
    const texts = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : []));
    const photoCount = msg.content.filter((b) => b.type === "image").length;
    // User turns are [context, photos…, message]; tool results have no text.
    const text = msg.role === "user" ? texts.at(-1) : texts.join("\n\n");
    if (text?.trim() || photoCount) bubbles.push({ role: msg.role, text: text ?? "", photoCount });
  }
  return bubbles;
}

const STARTERS = [
  "Let's plan my week!",
  "Plan my week, and keep breakfasts quick",
  "Plan my week with 2 snacks a day",
];

export default function ChatView({
  history,
  streamingText,
  error,
  busy,
  onSend,
}: {
  history: Anthropic.Beta.BetaMessageParam[];
  streamingText: string | null;
  error: string | null;
  busy: boolean;
  /** Resolves to false if sending failed, so the draft and photos are kept. */
  onSend: (message: string, photos: Blob[]) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Bubble | null>(null);
  const photos = usePhotos(MAX_PHOTOS);

  const bubbles = toBubbles(history);
  // Show the sent message right away, until it lands in history.
  const shown = busy && pending ? [...bubbles, pending] : bubbles;

  async function submit(text: string) {
    const message = text.trim();
    if ((!message && photos.photos.length === 0) || busy) return;
    const sending = photos.take();
    setPending({ role: "user", text: message, previews: sending.map((p) => p.previewUrl) });
    setDraft("");
    const ok = await onSend(message, sending.map((p) => p.blob));
    if (ok) photos.release(sending);
    else {
      setDraft(message);
      photos.restore(sending);
    }
    setPending(null);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-3">
        {shown.length === 0 && !busy && (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              Pick your phases and mode above, then say hi to Maia. She&apos;ll suggest a week that fits your targets.
              You can also send her photos of nutrition labels.
            </p>
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {shown.map((b, i) => (
          <Message key={i} {...b} />
        ))}
        {streamingText !== null && <Message role="assistant" text={streamingText || "Maia is thinking…"} />}
        {error && <p className="rounded-lg bg-accent-soft p-3 text-sm text-warn">⚠️ {error}</p>}
      </div>

      <form
        className="sticky bottom-0 mt-4 space-y-2 bg-background py-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <PhotoPreviews photos={photos.photos} onRemove={photos.remove} />
        {photos.error && <p className="text-xs text-warn">⚠️ {photos.error}</p>}
        <div className="flex items-end gap-2">
          <AddPhotoButton onPick={photos.add} disabled={busy || photos.full} />
          <AutoGrowTextarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(draft);
              }
            }}
            rows={1}
            placeholder={photos.photos.length ? "Add a note (optional)" : "Message Maia"}
            className="min-w-0 flex-1 rounded-2xl border border-line bg-surface px-3 py-2 text-base"
          />
          <button
            type="submit"
            disabled={busy || (!draft.trim() && photos.photos.length === 0)}
            className="rounded-full bg-accent px-4 py-2 font-medium text-on-accent disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function Message({ role, text, photoCount, previews }: Bubble) {
  if (role === "user") {
    return (
      <div className="ml-auto flex max-w-[85%] flex-col items-end gap-1">
        {previews && previews.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-1">
            {previews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img key={src} src={src} alt={`Photo ${i + 1}`} className="h-24 w-24 rounded-xl object-cover" />
            ))}
          </div>
        ) : photoCount ? (
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs">
            📷 {photoCount === 1 ? "1 photo" : `${photoCount} photos`}
          </span>
        ) : null}
        {text && (
          <div className="whitespace-pre-wrap rounded-2xl bg-accent px-3 py-2 text-sm text-on-accent">{text}</div>
        )}
      </div>
    );
  }
  return (
    <div className="max-w-[92%] rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-sm leading-relaxed">
      <RichText text={text} />
    </div>
  );
}

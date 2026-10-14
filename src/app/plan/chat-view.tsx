"use client";

import type Anthropic from "@anthropic-ai/sdk";
import { useState } from "react";
import AutoGrowTextarea from "@/components/auto-grow-textarea";
import RichText from "@/components/rich-text";

interface Bubble {
  role: "user" | "assistant";
  text: string;
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
    // User turns are [context, message]; tool results have no text.
    const text = msg.role === "user" ? texts.at(-1) : texts.join("\n\n");
    if (text?.trim()) bubbles.push({ role: msg.role, text });
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
  onSend: (message: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const bubbles = toBubbles(history);
  // Show the sent message right away, until it lands in history.
  const shown = busy && pending ? [...bubbles, { role: "user" as const, text: pending }] : bubbles;

  const submit = (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setPending(message);
    setDraft("");
    onSend(message);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-3">
        {shown.length === 0 && !busy && (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              Pick your phases and mode above, then say hi to Maia. She&apos;ll suggest a week that fits your targets.
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
        className="sticky bottom-0 mt-4 flex items-end gap-2 bg-background py-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
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
          placeholder="Message Maia"
          className="flex-1 rounded-2xl border border-line bg-surface px-3 py-2 text-base"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="self-end rounded-full bg-accent px-4 py-2 font-medium text-on-accent disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function Message({ role, text }: Bubble) {
  if (role === "user") {
    return (
      <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-accent px-3 py-2 text-sm text-on-accent">
        {text}
      </div>
    );
  }
  return (
    <div className="max-w-[92%] rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-sm leading-relaxed">
      <RichText text={text} />
    </div>
  );
}

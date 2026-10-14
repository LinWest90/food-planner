"use client";

import { useState } from "react";
import AutoGrowTextarea from "@/components/auto-grow-textarea";
import type { Comment } from "@/lib/data";

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Comments on one week between the user ("me") and their coach. `viewer`
 * decides whose messages appear on the right and whether a name field shows.
 */
export default function CommentThread({
  comments,
  viewer,
  onAdd,
  onDelete,
  coachName,
  onCoachNameChange,
}: {
  comments: Comment[];
  viewer: "coach" | "me";
  /** Resolves to false if adding failed, so the text is kept. */
  onAdd: (body: string) => Promise<boolean>;
  onDelete?: (comment: Comment) => void;
  coachName?: string;
  onCoachNameChange?: (name: string) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(comments.length > 0);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 text-xs font-medium underline">
        💬 {viewer === "coach" ? "Add a comment" : "Comments"}
      </button>
    );
  }

  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Comments</p>
      {comments.length === 0 && (
        <p className="mt-1 text-xs text-muted">
          {viewer === "coach" ? "No comments yet." : "No comments from your coach yet."}
        </p>
      )}
      <ul className="mt-2 space-y-2">
        {comments.map((c) => {
          const mine = c.author === viewer;
          const who = c.author === "coach" ? c.author_name || "Coach" : viewer === "me" ? "You" : "Client";
          return (
            <li key={c.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  mine ? "bg-accent text-on-accent" : "bg-accent-soft"
                }`}
              >
                {c.body}
              </div>
              <span className="mt-0.5 text-[11px] text-muted">
                {who} · {WHEN.format(new Date(c.created_at))}
                {viewer === "me" && c.author === "coach" && !c.read_at && (
                  <span className="ml-1 font-semibold text-accent">· New</span>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => confirm("Delete this comment?") && onDelete(c)}
                    className="ml-2 underline"
                  >
                    Delete
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <form
        className="mt-3 space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body || busy) return;
          setBusy(true);
          if (await onAdd(body)) setText("");
          setBusy(false);
        }}
      >
        {viewer === "coach" && onCoachNameChange && (
          <input
            value={coachName ?? ""}
            onChange={(e) => onCoachNameChange(e.target.value)}
            maxLength={60}
            placeholder="Your name (optional)"
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-base"
          />
        )}
        <AutoGrowTextarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder={viewer === "coach" ? "Write a comment" : "Reply to your coach"}
          className="w-full rounded-lg border border-line bg-background px-3 py-2 text-base"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-full bg-accent px-4 py-1.5 text-sm text-on-accent disabled:opacity-50"
        >
          {busy ? "Sending…" : viewer === "coach" ? "Post comment" : "Send reply"}
        </button>
      </form>
    </div>
  );
}

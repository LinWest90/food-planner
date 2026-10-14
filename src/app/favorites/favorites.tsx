"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AutoGrowTextarea from "@/components/auto-grow-textarea";
import { AddPhotoButton, PhotoPreviews, usePhotos } from "@/components/photo-picker";
import type { Favorite } from "@/lib/favorites";
import { addFavorite, deleteFavorite, fetchFavorites } from "@/lib/favorites-data";
import { MEAL_SLOTS, type Meal } from "@/lib/plan";
import { authHeaders } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/upload";

const SLOT_LABELS: Record<Meal["slot"], string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

const macroLine = (m: Meal) =>
  `${Math.round(m.calories)} kcal · P ${Math.round(m.proteinG)} · C ${Math.round(m.carbsG)} · F ${Math.round(m.fatG)}`;

export default function Favorites() {
  const [favorites, setFavorites] = useState<Favorite[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFavorites()
      .then(setFavorites)
      .catch((err: Error) => {
        setFavorites([]);
        setError(err.message);
      });
  }, []);

  const remove = async (f: Favorite) => {
    if (!confirm(`Remove "${f.meal.name}" from favorites?`)) return;
    try {
      await deleteFavorite(f.id);
      setFavorites((all) => all?.filter((x) => x.id !== f.id) ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Favorites</h1>
        <Link href="/" className="text-sm underline">
          Home
        </Link>
      </div>
      <p className="text-sm text-muted">
        Maia builds your weeks around these. Save meals from your plan with ⭐, or add one here.
      </p>

      <AddFavorite onSaved={(f) => setFavorites((all) => [...(all ?? []), f])} />

      {error && <p className="rounded-lg bg-accent-soft p-3 text-sm text-warn">⚠️ {error}</p>}

      {favorites &&
        MEAL_SLOTS.map((slot) => {
          const items = favorites.filter((f) => f.slot === slot);
          return (
            <section key={slot}>
              <h2 className="text-sm font-semibold">{SLOT_LABELS[slot]}</h2>
              {items.length === 0 ? (
                <p className="mt-1 text-xs text-muted">None yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {items.map((f) => (
                    <li key={f.id} className="rounded-xl border border-line bg-surface p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">⭐ {f.meal.name}</p>
                        <button type="button" onClick={() => remove(f)} className="shrink-0 text-xs text-muted underline">
                          Remove
                        </button>
                      </div>
                      <p className="text-xs text-muted tabular-nums">{macroLine(f.meal)}</p>
                      {f.meal.ingredients.length > 0 && (
                        <p className="mt-1 text-xs">{f.meal.ingredients.map((i) => `${i.quantity} ${i.item}`).join(", ")}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
    </div>
  );
}

function AddFavorite({ onSaved }: { onSaved: (f: Favorite) => void }) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<Meal["slot"]>("breakfast");
  const [text, setText] = useState("");
  const photos = usePhotos(4);
  const [draft, setDraft] = useState<{ meal: Meal; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl bg-accent px-4 py-3 font-medium text-on-accent"
      >
        + Add a favorite
      </button>
    );
  }

  async function estimate() {
    setBusy(true);
    setError(null);
    const sending = photos.take();
    try {
      const auth = await authHeaders();
      const imageFileIds = await Promise.all(sending.map((p) => uploadPhoto(p.blob, auth)));
      const res = await fetch("/api/favorites/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ slot, description: text, imageFileIds }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      setDraft(body);
      photos.release(sending);
    } catch (err) {
      photos.restore(sending);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await addFavorite(draft.meal));
      setDraft(null);
      setText("");
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4 text-sm">
      <h2 className="font-semibold">Add a favorite</h2>
      {draft ? (
        <div className="mt-3 space-y-2">
          <p className="font-medium">⭐ {draft.meal.name}</p>
          <p className="text-xs text-muted tabular-nums">{macroLine(draft.meal)}</p>
          {draft.meal.ingredients.length > 0 && (
            <p className="text-xs">{draft.meal.ingredients.map((i) => `${i.quantity} ${i.item}`).join(", ")}</p>
          )}
          <p className="text-xs italic text-muted">{draft.note}</p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="rounded-full bg-accent px-4 py-1.5 text-on-accent disabled:opacity-50"
            >
              Save favorite
            </button>
            <button type="button" onClick={() => setDraft(null)} className="rounded-full border border-line px-4 py-1.5">
              Edit description
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {MEAL_SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={slot === s}
                onClick={() => setSlot(s)}
                className={`rounded-full border px-3 py-1.5 ${
                  slot === s ? "border-accent bg-accent text-on-accent" : "border-line bg-background"
                }`}
              >
                {SLOT_LABELS[s]}
              </button>
            ))}
          </div>
          <AutoGrowTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Describe it, e.g. 'My banana protein pancakes: 1 banana, 2 eggs, 1 scoop vanilla whey, topped with Greek yogurt'"
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-base"
          />
          <PhotoPreviews photos={photos.photos} onRemove={photos.remove} />
          {photos.error && <p className="text-xs text-warn">⚠️ {photos.error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || (!text.trim() && photos.photos.length === 0)}
              onClick={estimate}
              className="rounded-full bg-accent px-4 py-1.5 text-on-accent disabled:opacity-50"
            >
              {busy ? "Maia is working it out…" : "Work out macros"}
            </button>
            <AddPhotoButton onPick={photos.add} disabled={busy || photos.full} label="Photo" />
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-line px-4 py-1.5">
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-warn">⚠️ {error}</p>}
    </section>
  );
}

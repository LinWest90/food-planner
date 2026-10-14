"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AutoGrowTextarea from "@/components/auto-grow-textarea";
import { AddPhotoButton, PhotoPreviews, usePhotos } from "@/components/photo-picker";
import type { Favorite, FavoriteMeal } from "@/lib/favorites";
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
                      <RecipeExtras meal={f.meal} />
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
  const [mode, setMode] = useState<"describe" | "link">("describe");
  const [link, setLink] = useState("");
  const [draft, setDraft] = useState<{ meal: FavoriteMeal; note: string } | null>(null);
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

  async function importLink() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ url: link, slot, note: text }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      setDraft(body);
    } catch (err) {
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
      setLink("");
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
          <RecipeExtras meal={draft.meal} />
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
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-accent-soft p-1">
            {(
              [
                ["describe", "Describe it"],
                ["link", "From a link"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full py-1.5 ${mode === m ? "bg-surface font-medium shadow-sm" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
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
          {mode === "link" && (
            <input
              type="url"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste a recipe link (https://…)"
              className="w-full rounded-lg border border-line bg-background px-3 py-2 text-base"
            />
          )}
          <AutoGrowTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={mode === "link" ? 1 : 3}
            placeholder={
              mode === "link"
                ? "Note for Maia (optional), e.g. 'I use half the oil'"
                : "Describe it, e.g. 'My banana protein pancakes: 1 banana, 2 eggs, 1 scoop vanilla whey, topped with Greek yogurt'"
            }
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-base"
          />
          {mode === "describe" && <PhotoPreviews photos={photos.photos} onRemove={photos.remove} />}
          {photos.error && <p className="text-xs text-warn">⚠️ {photos.error}</p>}
          <div className="flex flex-wrap gap-2">
            {mode === "link" ? (
              <button
                type="button"
                disabled={busy || !link.trim()}
                onClick={importLink}
                className="rounded-full bg-accent px-4 py-1.5 text-on-accent disabled:opacity-50"
              >
                {busy ? "Importing…" : "Import recipe"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy || (!text.trim() && photos.photos.length === 0)}
                  onClick={estimate}
                  className="rounded-full bg-accent px-4 py-1.5 text-on-accent disabled:opacity-50"
                >
                  {busy ? "Maia is working it out…" : "Work out macros"}
                </button>
                <AddPhotoButton onPick={photos.add} disabled={busy || photos.full} label="Photo" />
              </>
            )}
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

/** Source link and steps, for favorites imported from a recipe page. */
function RecipeExtras({ meal }: { meal: FavoriteMeal }) {
  if (!meal.sourceUrl && !meal.steps?.length) return null;
  let host = "";
  try {
    host = meal.sourceUrl ? new URL(meal.sourceUrl).hostname.replace(/^www\./, "") : "";
  } catch {
    // Not a valid URL; show no link.
  }
  return (
    <div className="mt-2 text-xs">
      {host && (
        <a href={meal.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Recipe on {host} ↗
        </a>
      )}
      {meal.steps && meal.steps.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer">Steps ({meal.steps.length})</summary>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {meal.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

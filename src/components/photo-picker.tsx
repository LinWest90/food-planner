"use client";

import { useRef, useState } from "react";
import { prepareImage, type PreparedImage } from "@/lib/images";

/** Photos attached to a message before it's sent. */
export function usePhotos(max: number) {
  const [photos, setPhotos] = useState<PreparedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function add(files: FileList | null) {
    setError(null);
    const picked = Array.from(files ?? []).slice(0, max - photos.length);
    if ((files?.length ?? 0) > picked.length) setError(`Up to ${max} photos per message.`);
    try {
      const prepared = await Promise.all(picked.map(prepareImage));
      setPhotos((p) => [...p, ...prepared]);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function remove(photo: PreparedImage) {
    URL.revokeObjectURL(photo.previewUrl);
    setPhotos((all) => all.filter((p) => p !== photo));
  }

  /** Takes the photos out for sending. Call `restore` if sending fails, or `release` once it succeeds. */
  function take() {
    const taken = photos;
    setPhotos([]);
    return taken;
  }
  const restore = (taken: PreparedImage[]) => setPhotos(taken);
  const release = (taken: PreparedImage[]) => taken.forEach((p) => URL.revokeObjectURL(p.previewUrl));

  return { photos, error, add, remove, take, restore, release, full: photos.length >= max };
}

export function PhotoPreviews({
  photos,
  onRemove,
}: {
  photos: PreparedImage[];
  onRemove: (photo: PreparedImage) => void;
}) {
  if (photos.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pt-1.5">
      {photos.map((p, i) => (
        <div key={p.previewUrl} className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img src={p.previewUrl} alt={`Photo ${i + 1}`} className="h-16 w-16 rounded-lg border border-line object-cover" />
          <button
            type="button"
            aria-label={`Remove photo ${i + 1}`}
            onClick={() => onRemove(p)}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-xs text-background"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/** Camera button; on phones this offers the camera or the photo library. */
export function AddPhotoButton({
  onPick,
  disabled,
  label,
}: {
  onPick: (files: FileList | null) => void;
  disabled?: boolean;
  /** Text after the icon; icon-only when omitted. */
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        aria-label={label ? undefined : "Add a photo"}
        disabled={disabled}
        onClick={() => input.current?.click()}
        className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-line bg-surface disabled:opacity-50 ${
          label ? "px-3 py-1.5 text-sm" : "h-10 w-10 text-lg"
        }`}
      >
        📷{label && <span>{label}</span>}
      </button>
    </>
  );
}

// Browser-side photo handling: shrink before upload so requests stay small
// and Claude gets a sensible size (about 1.5k px on the long edge).

const MAX_EDGE = 1568;

export interface PreparedImage {
  blob: Blob;
  previewUrl: string;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Couldn't read ${file.name || "that photo"}. Try a JPEG or PNG.`));
    };
    img.src = url;
  });
}

/** Resizes a picked photo to a JPEG no larger than MAX_EDGE on its long side. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that photo.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Couldn't process that photo.");
  return { blob, previewUrl: URL.createObjectURL(blob) };
}

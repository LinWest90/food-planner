"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/** A textarea that grows with its content, up to `maxHeight` px, then scrolls. */
export default function AutoGrowTextarea({
  maxHeight = 240,
  value,
  style,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { maxHeight?: number; value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, maxHeight]);

  return <textarea ref={ref} value={value} style={{ resize: "none", ...style }} {...props} />;
}

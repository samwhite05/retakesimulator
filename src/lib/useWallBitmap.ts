"use client";

import { useEffect, useState } from "react";
import {
  buildWallBitmapFromImageData,
  type WallBitmap,
} from "@/engine/simulation/minimapVision";

/**
 * Shared hook that loads a minimap image and derives a pixel-level wall
 * bitmap for vision-cone raycasting. The bitmap is keyed by the image src
 * string, so multiple consumers on the same page (the TacticalMap canvas
 * and the planning page's rail exposure calculator) share one decode +
 * one classification pass.
 */
const bitmapCache = new Map<string, WallBitmap>();
const pendingCache = new Map<string, Promise<WallBitmap | null>>();

function loadBitmap(src: string): Promise<WallBitmap | null> {
  const cached = bitmapCache.get(src);
  if (cached) return Promise.resolve(cached);
  const pending = pendingCache.get(src);
  if (pending) return pending;

  const p = new Promise<WallBitmap | null>((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w0 = img.naturalWidth;
        const h0 = img.naturalHeight;
        if (w0 < 2 || h0 < 2) {
          resolve(null);
          return;
        }
        // Use the minimap at its native resolution (up to 1200px). Downsampling
        // through canvas with default bilinear smoothing blurs thin wall
        // strokes (1-2px) below the wall-pixel threshold, which is what causes
        // rays to clip through walls in the cone renderer. Staying at native
        // resolution keeps wall detection pixel-exact.
        const maxDim = 1200;
        let rw = w0;
        let rh = h0;
        if (Math.max(rw, rh) > maxDim) {
          const s = maxDim / Math.max(rw, rh);
          rw = Math.max(2, Math.round(w0 * s));
          rh = Math.max(2, Math.round(h0 * s));
        }
        const canvas = document.createElement("canvas");
        canvas.width = rw;
        canvas.height = rh;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        // Disable smoothing so any downscale preserves hard edges instead of
        // blending wall pixels into neighbouring floor pixels.
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, rw, rh);
        const data = ctx.getImageData(0, 0, rw, rh);
        const bitmap = buildWallBitmapFromImageData(data);
        bitmapCache.set(src, bitmap);
        resolve(bitmap);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
  pendingCache.set(src, p);
  return p;
}

export function useWallBitmap(src: string | undefined): WallBitmap | null {
  const [bitmap, setBitmap] = useState<WallBitmap | null>(() =>
    src ? bitmapCache.get(src) ?? null : null
  );

  useEffect(() => {
    if (!src) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBitmap(null);
      return;
    }
    let cancelled = false;
    loadBitmap(src).then((b) => {
      if (!cancelled) setBitmap(b);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return bitmap;
}

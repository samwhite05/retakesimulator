"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shared requestAnimationFrame clock. Every hook consumer gets the same monotonically
 * increasing millisecond value (`t`), which can then be fed into a glyph's own
 * phase math (e.g. `Math.sin((t / 2000) * Math.PI * 2)`).
 *
 * We keep one RAF loop at the module level so N glyphs don't spawn N RAFs.
 * When no component is subscribed we stop ticking.
 */

type Listener = (t: number) => void;

const listeners = new Set<Listener>();
let rafId: number | null = null;
let startTime = 0;

function tick(now: number) {
  if (!startTime) startTime = now;
  const elapsed = now - startTime;
  for (const l of listeners) l(elapsed);
  if (listeners.size > 0) {
    rafId = requestAnimationFrame(tick);
  } else {
    rafId = null;
  }
}

function subscribe(l: Listener) {
  listeners.add(l);
  if (rafId == null) {
    rafId = requestAnimationFrame(tick);
  }
  return () => {
    listeners.delete(l);
    if (listeners.size === 0 && rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

/**
 * Returns a continuously updating millisecond timestamp driven by RAF.
 * Re-renders its consumer on every frame while mounted — use sparingly, and
 * only inside components that already paint every frame (e.g. Konva canvases).
 */
export function useAnimationClock(): number {
  const [t, setT] = useState(0);
  const lastRef = useRef(0);

  useEffect(() => {
    return subscribe((now) => {
      if (now - lastRef.current < 16) return;
      lastRef.current = now;
      setT(now);
    });
  }, []);

  return t;
}

/**
 * Same idea but returns a stable ref-based value you can read inside draw loops
 * without triggering a React re-render on every frame. Pair with a manual
 * `Konva.Layer.batchDraw()` when you want maximum paint smoothness.
 */
export function useAnimationClockRef(): React.MutableRefObject<number> {
  const ref = useRef(0);
  useEffect(() => {
    return subscribe((now) => {
      ref.current = now;
    });
  }, []);
  return ref;
}

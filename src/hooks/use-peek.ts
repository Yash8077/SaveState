import { useCallback, useRef, useState, type PointerEvent } from "react";

export type PeekTarget = {
  catalogId: string;
  title: string;
  coverUrl?: string | null;
  headerUrl?: string | null;
};

const HOLD_MS = 480;
const MOVE_PX = 12;

export function usePeek<T extends PeekTarget>() {
  const [target, setTarget] = useState<T | null>(null);
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const didPeek = useRef(false);

  const clearTimer = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const open = useCallback((next: T) => {
    didPeek.current = true;
    setTarget(next);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(10);
    }
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent, next: T) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      didPeek.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
      clearTimer();
      timer.current = window.setTimeout(() => {
        open(next);
        timer.current = null;
      }, HOLD_MS);
    },
    [clearTimer, open],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!origin.current || timer.current == null) return;
      const dx = event.clientX - origin.current.x;
      const dy = event.clientY - origin.current.y;
      if (dx * dx + dy * dy > MOVE_PX * MOVE_PX) {
        clearTimer();
      }
    },
    [clearTimer],
  );

  const onPointerUp = useCallback(() => {
    clearTimer();
    origin.current = null;
  }, [clearTimer]);

  const onClickCapture = useCallback((event: { preventDefault: () => void }) => {
    if (!didPeek.current) return;
    event.preventDefault();
    didPeek.current = false;
  }, []);

  const close = useCallback(() => setTarget(null), []);

  return {
    target,
    open,
    close,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onClickCapture,
  };
}

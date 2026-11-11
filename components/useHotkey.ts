"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `action` when a single key is pressed on its own, the way Linear's
 * one-letter shortcuts work. Ignored while typing in a field or with a modifier held.
 */
export function useHotkey(key: string, action: () => void) {
  const latest = useRef(action);
  useEffect(() => {
    latest.current = action;
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== key) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      latest.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key]);
}

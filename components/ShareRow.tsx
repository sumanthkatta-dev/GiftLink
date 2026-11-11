"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { m } from "@/lib/messages";
import { useHotkey } from "./useHotkey";

const noop = () => () => {};

/** The share link on the sender's dashboard. Copy with the button or by pressing C. */
export function ShareRow({ path }: { path: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
  const url = origin + path;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard is unavailable: select the text so it can be copied by hand.
      input.current?.focus();
      input.current?.select();
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }

  useHotkey("c", copy);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-fg">
          {m.manage.shareLabel}
        </label>
        <span className="hidden items-center gap-1.5 text-[12px] text-fg-3 sm:flex">
          <kbd className="rounded border border-edge-2 px-1 font-mono text-[10px] leading-4">C</kbd>
          {m.manage.copyShortcut}
        </span>
      </div>
      <div
        className={`flex h-11 items-center rounded-xl border bg-canvas pl-3.5 pr-1.5 transition-colors duration-300 ${
          copied ? "border-brand/60" : "border-edge focus-within:border-edge-2"
        }`}
      >
        <input
          id={id}
          ref={input}
          readOnly
          value={url}
          aria-describedby={`${id}-hint`}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] text-fg-2 outline-none selection:bg-brand/40"
        />
        <button
          type="button"
          onClick={copy}
          className={`relative inline-flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-lg px-3 text-[13px] font-medium transition-all duration-300 active:scale-95 ${
            copied ? "bg-brand text-white" : "bg-fg text-canvas hover:bg-white"
          }`}
        >
          {copied ? (
            <svg key="ok" aria-hidden="true" className="dash-pop size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          ) : (
            <svg key="copy" aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="11" height="11" rx="2.5" />
              <path d="M5 15V6a2 2 0 0 1 2-2h8" />
            </svg>
          )}
          <span aria-live="polite">{copied ? m.copy.copied : m.copy.copy}</span>
        </button>
      </div>
      <p id={`${id}-hint`} className="text-[12px] text-fg-3">
        {m.manage.shareHint}
      </p>
    </div>
  );
}

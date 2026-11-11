"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { IconCheck, IconCopy } from "@/components/icons";
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
  useEffect(() => () => clearTimeout(timer.current), []);

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
        <label htmlFor={id} className="text-[14px] font-medium text-fg">
          {m.manage.shareLabel}
        </label>
        <span className="hidden items-center gap-1.5 text-[12px] text-fg-muted sm:flex">
          <kbd className="rounded border border-line-strong px-1.5 font-sans text-[11px] leading-5">C</kbd>
          {m.manage.copyShortcut}
        </span>
      </div>
      <div
        className={`flex min-h-12 items-center gap-2 rounded-control border bg-canvas py-1.5 pl-3.5 pr-1.5 transition-colors duration-300 ${
          copied ? "border-accent/60" : "border-line focus-within:border-line-strong"
        }`}
      >
        <input
          id={id}
          ref={input}
          readOnly
          value={url}
          aria-describedby={`${id}-hint`}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-fg-muted outline-none"
        />
        <button
          type="button"
          onClick={copy}
          className={`ui-button ui-button-sm shrink-0 ${copied ? "ui-button-primary" : "ui-button-secondary"}`}
        >
          {copied ? <IconCheck key="ok" className="pop-in size-4" /> : <IconCopy key="copy" className="size-4" />}
          <span aria-live="polite">{copied ? m.copy.copied : m.copy.copy}</span>
        </button>
      </div>
      <p id={`${id}-hint`} className="text-[13px] text-fg-muted">
        {m.manage.shareHint}
      </p>
    </div>
  );
}

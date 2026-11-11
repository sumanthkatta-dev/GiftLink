"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { IconCheck, IconCopy } from "@/components/icons";
import { m } from "@/lib/messages";

const noop = () => () => {};

/** A read-only link with a copy button. `path` is turned into a full URL in the browser. */
export function CopyLink({
  label,
  hint,
  path,
  hintIcon,
}: {
  label: string;
  hint: string;
  path: string;
  hintIcon?: ReactNode;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [copied, setCopied] = useState(false);
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
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className="text-[14px] font-medium text-fg">
        {label}
      </label>
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
      <p id={`${id}-hint`} className="flex items-start gap-2 text-[13px] leading-relaxed text-fg-muted">
        {hintIcon}
        {hint}
      </p>
    </div>
  );
}

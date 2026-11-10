"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { m } from "@/lib/messages";

const noop = () => () => {};

/** A read-only link with a copy button. `path` is turned into a full URL in the browser. */
export function CopyLink({ label, hint, path }: { label: string; hint: string; path: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
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
      input.current?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          ref={input}
          className="input min-w-0 flex-1"
          readOnly
          value={url}
          aria-describedby={`${id}-hint`}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button type="button" className="btn btn-primary shrink-0" onClick={copy}>
          <span aria-live="polite">{copied ? m.copy.copied : m.copy.copy}</span>
        </button>
      </div>
      <p id={`${id}-hint`} className="text-sm text-muted">
        {hint}
      </p>
    </div>
  );
}

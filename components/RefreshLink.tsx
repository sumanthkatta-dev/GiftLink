"use client";

import { m } from "@/lib/messages";
import { useHotkey } from "./useHotkey";

/** Reloads the dashboard. A plain link, so it works before JavaScript loads; R does the same. */
export function RefreshLink({ href }: { href: string }) {
  useHotkey("r", () => window.location.assign(href));

  return (
    <a
      href={href}
      className="group inline-flex h-8 items-center gap-2 rounded-lg border border-edge bg-raised px-3 text-[13px] text-fg-2 transition-colors hover:border-edge-2 hover:text-fg"
    >
      <svg
        aria-hidden="true"
        className="size-3.5 transition-transform duration-500 ease-out-expo group-hover:rotate-180"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5" />
      </svg>
      {m.manage.refresh}
      <kbd className="ml-0.5 hidden rounded border border-edge-2 px-1 font-mono text-[10px] leading-4 text-fg-3 sm:inline">R</kbd>
    </a>
  );
}

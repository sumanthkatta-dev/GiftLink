"use client";

import { IconRefresh } from "@/components/icons";
import { m } from "@/lib/messages";
import { useHotkey } from "./useHotkey";

/** Reloads the dashboard. A plain link, so it works before JavaScript loads; R does the same. */
export function RefreshLink({ href }: { href: string }) {
  useHotkey("r", () => window.location.assign(href));

  return (
    <a href={href} className="group ui-button ui-button-sm ui-button-secondary">
      <IconRefresh className="size-4 transition-transform duration-500 ease-out group-hover:rotate-180" />
      {m.manage.refresh}
      <kbd className="ml-0.5 hidden rounded border border-line-strong px-1.5 font-sans text-[11px] leading-5 text-fg-muted sm:inline">R</kbd>
    </a>
  );
}

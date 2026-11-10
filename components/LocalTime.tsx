"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

export function formatLocal(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

/** Shows a UTC timestamp in the viewer's own time zone and locale. */
export function LocalTime({ iso }: { iso: string }) {
  const label = useSyncExternalStore(
    noop,
    () => formatLocal(iso),
    () => "",
  );
  return <time dateTime={iso}>{label}</time>;
}

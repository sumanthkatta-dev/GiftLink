"use client";

import { useSyncExternalStore } from "react";
import { m } from "@/lib/messages";

function subscribe(onTick: () => void) {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
}

/** Whole seconds, so the snapshot stays the same between ticks. */
const nowSeconds = () => Math.floor(Date.now() / 1000);

/** A live countdown to the unlock time, in the viewer's clock. Renders nothing on the server. */
export function Countdown({ iso }: { iso: string }) {
  const now = useSyncExternalStore(subscribe, nowSeconds, () => null);
  if (now === null) return <div className="h-[52px]" />;

  const left = Math.max(0, Math.floor(Date.parse(iso) / 1000) - now);
  if (left === 0) return <p className="text-[13px] text-brand-soft">{m.manage.unlockReady}</p>;

  const parts = [
    [Math.floor(left / 86400), m.manage.countdown.d],
    [Math.floor((left % 86400) / 3600), m.manage.countdown.h],
    [Math.floor((left % 3600) / 60), m.manage.countdown.m],
    [left % 60, m.manage.countdown.s],
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="text-[13px] text-fg-2">{m.manage.unlocksIn}</span>
      <div className="flex items-center gap-1.5 font-mono" role="timer" aria-live="off">
        {parts.map(([value, unit]) => (
          <span
            key={unit}
            className="inline-flex h-9 min-w-12 items-baseline justify-center gap-0.5 rounded-md border border-edge bg-raised-2 px-2 pt-[7px] tabular-nums"
          >
            <span key={value} className="digit-in text-[15px] font-medium text-fg">
              {String(value).padStart(2, "0")}
            </span>
            <span className="text-[11px] text-fg-3">{unit}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

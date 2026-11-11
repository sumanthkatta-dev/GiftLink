"use client";

import { useEffect, useState } from "react";
import { Wrap } from "@/components/wraps/Wrap";
import { m } from "@/lib/messages";
import { WRAP_STYLES } from "@/lib/wraps";

const CLOSED_MS = 1900;
const OPEN_MS = 3800;
const LEAVE_MS = 420;

/**
 * The product, shown working: each wrap waits, opens to its note, then gives
 * way to the next. With reduced motion it stays still on the closed card.
 */
export function LandingDemo() {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers = [
      setTimeout(() => setOpen(true), CLOSED_MS),
      setTimeout(() => setLeaving(true), CLOSED_MS + OPEN_MS),
      setTimeout(() => {
        setLeaving(false);
        setOpen(false);
        setIndex((i) => (i + 1) % WRAP_STYLES.length);
      }, CLOSED_MS + OPEN_MS + LEAVE_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [index]);

  const kind = WRAP_STYLES[index];

  return (
    <div role="img" aria-label={m.landing.demoLabel} className="demo-stage stage-light">
      <div key={kind} className="demo-swap" data-leaving={leaving ? "" : undefined}>
        <Wrap
          kind={kind}
          size="preview"
          state={open ? "open" : "closed"}
          play
          idle
          note={m.landing.demoNote}
          receiverName={m.landing.demoReceiver}
          senderName={m.landing.demoSender}
          seed="demo"
        />
      </div>
    </div>
  );
}

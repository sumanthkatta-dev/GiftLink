"use client";

import { useId } from "react";
import { m } from "@/lib/messages";
import { NoteText, OpenButton, rootProps, type WrapProps } from "./shared";

/** The wax's uneven edge: a circle pushed in and out a little, smoothed through midpoints. */
const SEAL_EDGE = (() => {
  const points: [number, number][] = [];
  const count = 22;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = 45 + Math.sin(i * 2.7) * 2.6 + Math.cos(i * 5.3) * 1.6;
    points.push([50 + Math.cos(angle) * r, 50 + Math.sin(angle) * r]);
  }
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2].map((n) => n.toFixed(2));
  let d = `M${mid(points[count - 1], points[0]).join(" ")}`;
  for (let i = 0; i < count; i++) {
    const next = points[(i + 1) % count];
    d += ` Q${points[i][0].toFixed(2)} ${points[i][1].toFixed(2)} ${mid(points[i], next).join(" ")}`;
  }
  return `${d}Z`;
})();

function Seal({ initial, id }: { initial: string; id: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-wax`} cx="38%" cy="32%" r="75%">
          <stop offset="0" style={{ stopColor: "var(--wax-light)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--wax)" }} />
          <stop offset="1" style={{ stopColor: "var(--wax-dark)" }} />
        </radialGradient>
      </defs>
      <path d={SEAL_EDGE} fill={`url(#${id}-wax)`} />
      {/* The pressed ring: a dark groove with a lit lip below it. */}
      <circle cx="50" cy="51.2" r="29" fill="none" style={{ stroke: "var(--wax-light)" }} strokeWidth="1.6" opacity="0.55" />
      <circle cx="50" cy="50" r="29" fill="none" style={{ stroke: "var(--wax-dark)" }} strokeWidth="2.2" opacity="0.8" />
      <text
        x="50"
        y="51.5"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: "var(--wax-light)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}
        fontSize="34"
        opacity="0.55"
      >
        {initial}
      </text>
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: "var(--wax-dark)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}
        fontSize="34"
      >
        {initial}
      </text>
    </svg>
  );
}

/**
 * Laid paper with real folds and a wax seal. A tap presses the seal until it
 * cracks; the flap turns over, the card rises out and the envelope sinks away.
 */
export function EnvelopeWrap(p: WrapProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const initial = (p.senderName.trim().charAt(0) || "G").toUpperCase();
  const open = p.state === "open";

  return (
    <div className="wrap ew" {...rootProps(p)}>
      <div className="wrap-ground" />
      <div className="wrap-float">
        <div className="ew-part ew-back" />

        <div className="ew-card-slot" aria-hidden={!open || undefined}>
          <div className="ew-card paper">
            <span className="foil-frame" />
            <div className="ew-card-inner">
              <div className="cw-back-body">
                <NoteText note={p.note} placeholder={p.notePlaceholder} arrive={p.noteArrives} />
              </div>
              <div className="cw-back-sign">
                <span className="foil-rule" style={{ inlineSize: "1.4em" }} />
                <span className="wrap-text wrap-signature">{m.gift.signature(p.senderName)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ew-part ew-front">
          <div className="ew-fold ew-fold-left" />
          <div className="ew-fold ew-fold-right" />
          <div className="ew-fold ew-fold-shadow-soft" />
          <div className="ew-fold ew-fold-shadow" />
          <div className="ew-fold ew-fold-bottom" />
          <p
            className="wrap-text absolute inset-x-0 bottom-[0.9em] truncate px-[2.2em] text-center font-serif text-[1.5em] italic leading-tight"
            style={{ color: "var(--ink-blue)" }}
            aria-hidden={open || undefined}
          >
            {p.receiverName}
          </p>
        </div>

        <div className="ew-part ew-flap-wrap">
          <div className="ew-flap-shade" />
          <div className="ew-flap">
            <div className="ew-flap-face ew-flap-out" />
            <div className="ew-flap-face ew-flap-in" />
          </div>
        </div>

        <div className="ew-seal">
          <div className="ew-seal-half ew-seal-left">
            <Seal initial={initial} id={`${id}l`} />
          </div>
          <div className="ew-seal-half ew-seal-right">
            <Seal initial={initial} id={`${id}r`} />
          </div>
          <span className="ew-seal-glint" />
        </div>
      </div>
      <OpenButton p={p} />
    </div>
  );
}

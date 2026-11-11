"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { m } from "@/lib/messages";
import { nameLength, NoteText, OpenButton, rootProps, type WrapProps } from "./shared";

/**
 * A thick ivory card with a gold foil frame. Light sweeps across it while it
 * waits; a tap presses it, lifts it and turns it over to the note.
 */
export function CardWrap(p: WrapProps) {
  const tilt = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const canTilt = Boolean(p.onOpen) && p.state === "closed";

  // On a mouse, the card leans a little toward the pointer, like something held.
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!canTilt || event.pointerType !== "mouse" || !tilt.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      tilt.current?.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
      tilt.current?.style.setProperty("--rx", `${(-y * 7).toFixed(2)}deg`);
    });
  }

  function resetTilt() {
    cancelAnimationFrame(frame.current);
    tilt.current?.style.removeProperty("--rx");
    tilt.current?.style.removeProperty("--ry");
  }

  useEffect(() => {
    if (!canTilt) resetTilt();
    return () => cancelAnimationFrame(frame.current);
  }, [canTilt]);

  const open = p.state === "open";

  return (
    <div className="wrap cw" {...rootProps(p)} onPointerMove={onPointerMove} onPointerLeave={resetTilt}>
      <div className="wrap-ground" />
      <div className="wrap-float">
        <div ref={tilt} className="cw-tilt">
          <div className="cw-press">
            <div className="cw-flip">
              <div className="cw-face cw-front paper" aria-hidden={open || undefined}>
                <span className="foil-frame" />
                <span className="wrap-text wrap-for">{m.gift.cardFor}</span>
                <span className="wrap-text wrap-name" data-length={nameLength(p.receiverName)}>
                  {p.receiverName}
                </span>
                <span className="foil-rule" />
                <span className="wrap-text wrap-from">{m.gift.cardFrom(p.senderName)}</span>
                <span className="wrap-sheen" />
              </div>

              <div className="cw-face cw-back paper" aria-hidden={!open || undefined}>
                <span className="foil-frame" />
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
        </div>
      </div>
      <OpenButton p={p} />
    </div>
  );
}

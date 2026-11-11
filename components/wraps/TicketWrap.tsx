"use client";

import { m } from "@/lib/messages";
import { nameLength, NoteText, OpenButton, rootProps, type WrapProps } from "./shared";

/** A four-digit serial that stays the same for one gift. */
function serialFrom(seed: string) {
  let hash = 7;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 9000;
  return String(1000 + hash);
}

/**
 * A printed ticket on heavy stock. A tap bends the stub on its perforation
 * until it tears away; the ticket recoils and turns over to the note.
 */
export function TicketWrap(p: WrapProps) {
  const serial = m.gift.ticketSerial(serialFrom(p.seed ?? p.receiverName + p.senderName));
  const open = p.state === "open";

  return (
    <div className="wrap tw" {...rootProps(p)}>
      <div className="wrap-ground" />
      <div className="wrap-float">
        <div className="tw-press">
          <div className="tw-shadow" />
          <div className="tw-recoil">
            <div className="tw-main-shadow" />
            <div className="tw-main">
              <div className="tw-face tw-front" aria-hidden={open || undefined}>
                <div className="tw-band">
                  <span className="wrap-text tw-band-label">{m.gift.ticketAdmit}</span>
                  <span className="wrap-sheen" style={{ ["--sheen-delay" as string]: "2.4s" }} />
                </div>
                <div className="tw-body">
                  <span className="wrap-text wrap-for">{m.gift.cardFor}</span>
                  <span className="wrap-text wrap-name" data-length={nameLength(p.receiverName)}>
                    {p.receiverName}
                  </span>
                  <span className="tw-rule" />
                  <span className="wrap-text wrap-from">{m.gift.cardFrom(p.senderName)}</span>
                </div>
                <div className="wrap-text tw-meta">
                  <span>{m.gift.ticketValid}</span>
                  <span>{serial}</span>
                </div>
                <span className="tw-perf" />
              </div>

              <div className="tw-face tw-back" aria-hidden={!open || undefined}>
                <span className="tw-perf" />
                <div className="cw-back-body">
                  <NoteText note={p.note} placeholder={p.notePlaceholder} arrive={p.noteArrives} />
                </div>
                <div className="cw-back-sign">
                  <span className="tw-rule" style={{ inlineSize: "1.4em" }} />
                  <span className="wrap-text wrap-signature">{m.gift.signature(p.senderName)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="tw-stub">
            <div className="tw-stub-bend">
              <div className="tw-stub-paper">
                <span className="tw-perf" />
                <span className="wrap-text tw-stub-label">{m.gift.ticketAdmit}</span>
                <span className="wrap-text tw-stub-serial">{serial}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <OpenButton p={p} />
    </div>
  );
}

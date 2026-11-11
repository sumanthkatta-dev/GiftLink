import type { WrapStyle } from "@/lib/wraps";

export type WrapState = "closed" | "open";
/** full: the gift page. preview: the create form. small: countdown and created screens. mini: wrap tiles. */
export type WrapSize = "full" | "preview" | "small" | "mini";

export interface WrapProps {
  receiverName: string;
  senderName: string;
  /** The note written inside. null while it isn't known yet (before the reveal). */
  note: string | null;
  /** Shown inside in place of an empty note, in the create preview. */
  notePlaceholder?: string;
  /** Let the note rise into place when it appears. */
  noteArrives?: boolean;
  state: WrapState;
  size: WrapSize;
  /** Run the full opening choreography (press, lift, recoil), not just the state change. */
  play?: boolean;
  /** Idle motion while closed. */
  idle?: boolean;
  /** When set, the wrap is a button that calls this. */
  onOpen?: () => void;
  openLabel?: string;
  /** Seeds the ticket's serial number so it stays the same for one gift. */
  seed?: string;
}

export interface AnyWrapProps extends WrapProps {
  kind: WrapStyle;
}

export function nameLength(name: string) {
  return name.length > 22 ? "long" : name.length > 12 ? "medium" : undefined;
}

export function noteLength(note: string) {
  return note.length > 170 || note.split("\n").length > 5 ? "long" : undefined;
}

/** The attributes every wrap root shares. */
export function rootProps(p: WrapProps) {
  return {
    "data-size": p.size,
    "data-state": p.state,
    "data-play": p.play ? "" : undefined,
    "data-idle": p.idle ? "" : undefined,
    // A wrap that can't be opened is a picture of one. Its words are said elsewhere.
    "aria-hidden": p.onOpen ? undefined : true,
  } as const;
}

export function NoteText({ note, placeholder, arrive }: { note: string | null; placeholder?: string; arrive?: boolean }) {
  if (note) {
    return (
      <p className="wrap-text wrap-note" data-length={noteLength(note)} data-arrive={arrive ? "" : undefined}>
        {note}
      </p>
    );
  }
  if (placeholder) {
    return (
      <p className="wrap-text wrap-note" data-placeholder="">
        {placeholder}
      </p>
    );
  }
  return null;
}

export function OpenButton({ p }: { p: WrapProps }) {
  if (!p.onOpen) return null;
  return (
    <button
      type="button"
      className="wrap-hit"
      onClick={p.onOpen}
      disabled={p.state === "open"}
      aria-label={p.openLabel}
    />
  );
}

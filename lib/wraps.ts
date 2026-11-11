/**
 * The wraps a gift can come in. Safe to import from client and server code.
 *
 * "box" was retired in the redesign. Gifts saved with it still exist, so any
 * value that isn't a current wrap is read as "card".
 */
export const WRAP_STYLES = ["card", "envelope", "ticket"] as const;

export type WrapStyle = (typeof WRAP_STYLES)[number];

export const DEFAULT_WRAP: WrapStyle = "card";

export function isWrapStyle(value: unknown): value is WrapStyle {
  return typeof value === "string" && (WRAP_STYLES as readonly string[]).includes(value);
}

export function normalizeWrap(value: unknown): WrapStyle {
  return isWrapStyle(value) ? value : DEFAULT_WRAP;
}

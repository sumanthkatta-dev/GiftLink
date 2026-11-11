/**
 * The counting rule behind rate limits, with no storage attached, so it can be
 * reasoned about (and tested) on its own. lib/rate-limit.ts stores the hits.
 */

export interface Rule {
  windowMs: number;
  max: number;
}

/** One counted attempt. The id lets a single attempt be handed back (see release). */
export interface Hit {
  id: string;
  at: number;
}

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

export const RULES = {
  /** Creating gifts: 10 per hour and 30 per day, per IP. */
  create: [
    { windowMs: HOUR, max: 10 },
    { windowMs: DAY, max: 30 },
  ],
  /** Wrong secret answers: 10 per gift, per IP, per hour. */
  answer: [{ windowMs: HOUR, max: 10 }],
  /** Reports: 20 per hour per IP, so one visitor can't flood the reports collection. */
  report: [{ windowMs: HOUR, max: 20 }],
} satisfies Record<string, Rule[]>;

export type Bucket = keyof typeof RULES;

export function longestWindow(rules: Rule[]): number {
  return Math.max(...rules.map((rule) => rule.windowMs));
}

/**
 * Sliding windows: drops hits older than the longest window, then allows the
 * attempt only if every window still has room. Returns the hits to keep
 * (without the new one; the caller adds it when allowed).
 */
export function decide(hits: Hit[], rules: Rule[], now: number): { allowed: boolean; kept: Hit[] } {
  const longest = longestWindow(rules);
  const kept = hits.filter((hit) => now - hit.at < longest && hit.at <= now);
  const allowed = rules.every((rule) => kept.filter((hit) => now - hit.at < rule.windowMs).length < rule.max);
  return { allowed, kept };
}

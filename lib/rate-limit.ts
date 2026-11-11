/**
 * Rate limits, counted in Firestore so they hold across Vercel's many
 * short-lived server instances.
 *
 * Visitors are told apart by IP address (first value of x-forwarded-for).
 * Only a salted hash of the IP is stored, never the address itself.
 *
 * Without Firebase keys (local development) nothing is counted. If Firestore
 * errors, the attempt is allowed and a warning is logged, so an outage of the
 * counter never locks real people out.
 */
import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { Timestamp } from "firebase-admin/firestore";
import { firestore, firestoreConfigured } from "@/lib/firestore-store";
import { decide, longestWindow, RULES, type Bucket, type Hit } from "@/lib/rate-limit-core";

export type LimitResult = { allowed: true; release: () => Promise<void> } | { allowed: false };

const noop = async () => undefined;

/**
 * The salt is derived from the Firebase private key, which is secret and
 * already set wherever counting happens, so no extra variable is needed.
 * IP_HASH_SALT overrides it if you'd rather manage the salt separately.
 */
function salt(): string {
  const secret = process.env.IP_HASH_SALT || process.env.FIREBASE_PRIVATE_KEY || "giftlink-local-development";
  return createHash("sha256").update(`giftlink-ip-salt:${secret}`).digest("hex");
}

export function hashIp(ip: string): string {
  return createHmac("sha256", salt()).update(ip).digest("base64url").slice(0, 32);
}

/** Salted hash of the visitor's IP, from the first value of x-forwarded-for. */
export async function clientIpHash(): Promise<string> {
  const list = await headers();
  const ip =
    list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip")?.trim() || "unknown";
  return hashIp(ip);
}

const collection = () => firestore().collection("rateLimits");

/**
 * Counts one attempt against `bucket` for `subject` (an IP hash, or gift id
 * plus IP hash). Refuses when a window is full. On success, `release` hands
 * the attempt back, for attempts that turn out not to count (a correct answer).
 */
export async function consume(bucket: Bucket, subject: string): Promise<LimitResult> {
  if (!firestoreConfigured()) return { allowed: true, release: noop };

  const rules = RULES[bucket];
  const ref = collection().doc(`${bucket}_${subject}`);
  const hitId = randomBytes(6).toString("base64url");

  try {
    const allowed = await firestore().runTransaction(async (tx) => {
      const now = Date.now();
      const snapshot = await tx.get(ref);
      const hits = (snapshot.get("hits") as Hit[] | undefined) ?? [];
      const verdict = decide(hits, rules, now);
      if (!verdict.allowed) return false;
      tx.set(ref, {
        hits: [...verdict.kept, { id: hitId, at: now }],
        // For an optional Firestore TTL policy on this field, which deletes stale counters.
        expiresAt: Timestamp.fromMillis(now + longestWindow(rules)),
      });
      return true;
    });
    if (!allowed) return { allowed: false };
    return {
      allowed: true,
      release: async () => {
        try {
          await firestore().runTransaction(async (tx) => {
            const snapshot = await tx.get(ref);
            const hits = (snapshot.get("hits") as Hit[] | undefined) ?? [];
            if (hits.some((hit) => hit.id === hitId)) {
              tx.update(ref, { hits: hits.filter((hit) => hit.id !== hitId) });
            }
          });
        } catch (error) {
          console.warn("GiftLink: could not release a rate limit hit", error);
        }
      },
    };
  } catch (error) {
    console.warn(`GiftLink: rate limit check for "${bucket}" failed; allowing the attempt.`, error);
    return { allowed: true, release: noop };
  }
}

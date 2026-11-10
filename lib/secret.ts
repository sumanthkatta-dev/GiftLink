import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** "  Blue   Whale " and "blue whale" count as the same answer. */
function normalize(answer: string): string {
  return answer.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function hashAnswer(answer: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(normalize(answer), salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function answerMatches(answer: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(normalize(answer), Buffer.from(saltHex, "hex"), 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function newManageKey(): string {
  return randomBytes(18).toString("base64url");
}

export function keysMatch(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

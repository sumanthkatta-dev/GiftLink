/**
 * Gift storage in Cloud Firestore, used whenever the Firebase env vars are set.
 * Runs on the server only, through the Admin SDK, so Firestore security rules
 * can stay fully locked: browsers never talk to the database directly.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { FieldValue, initializeFirestore, type DocumentData, type Firestore } from "firebase-admin/firestore";
import type { Gift, GiftStore } from "@/lib/store";
import { normalizeWrap } from "@/lib/wraps";

const ID_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;
/** gRPC status code Firestore returns when a document id is already taken. */
const ALREADY_EXISTS = 6;
/** A named app, so this never collides with another Firebase app in the same process. */
const APP_NAME = "giftlink";

export function firestoreConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY,
  );
}

/**
 * The key arrives in different shapes depending on where it was pasted: with
 * literal "\n" sequences (.env files, most dashboards), with real line breaks,
 * or still wrapped in the quotes from the JSON file. All of them become a valid PEM.
 */
function privateKey(): string {
  let key = (process.env.FIREBASE_PRIVATE_KEY ?? "").trim();
  if (key.length > 1 && key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
  return key.replace(/\\n/g, "\n");
}

let db: Firestore | null = null;

export function firestore(): Firestore {
  if (db) return db;
  const app: App =
    getApps().find((existing) => existing.name === APP_NAME) ??
    initializeApp(
      {
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey(),
        }),
      },
      APP_NAME,
    );
  // REST instead of gRPC: much faster cold starts on serverless hosts like Vercel.
  // Calling this again with the same settings (after a dev reload) returns the same instance.
  db = initializeFirestore(app, { preferRest: true });
  return db;
}

const gifts = () => firestore().collection("gifts");
const reports = () => firestore().collection("reports");

/** Older gifts may hold a retired wrap name; map it to a current one. */
function toGift(data: DocumentData): Gift {
  const gift = data as Gift;
  return { ...gift, wrapStyle: normalizeWrap(gift.wrapStyle) };
}

export const firestoreStore: GiftStore = {
  async createGift(input) {
    // Ids are random, so a clash is very unlikely; `create` refuses to overwrite, and we retry.
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = randomBytes(8).toString("base64url");
      const gift: Gift = { ...input, id, createdAt: new Date().toISOString(), openedAt: null };
      try {
        await gifts().doc(id).create(gift);
        return gift;
      } catch (error) {
        if ((error as { code?: number }).code === ALREADY_EXISTS) continue;
        throw error;
      }
    }
    throw new Error("Could not find a free gift id");
  },

  async getGift(id) {
    if (!ID_PATTERN.test(id)) return null;
    const snapshot = await gifts().doc(id).get();
    const data = snapshot.data();
    return data ? toGift(data) : null;
  },

  async markOpened(id) {
    if (!ID_PATTERN.test(id)) return null;
    const ref = gifts().doc(id);
    // A transaction, so two receivers opening at once still record a single first-open time.
    return firestore().runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const data = snapshot.data();
      if (!data) return null;
      const gift = toGift(data);
      if (!gift.openedAt) {
        gift.openedAt = new Date().toISOString();
        tx.update(ref, { openedAt: gift.openedAt });
      }
      return gift;
    });
  },

  async addReport(report) {
    if (!ID_PATTERN.test(report.giftId)) return "not_found";
    const giftRef = gifts().doc(report.giftId);
    // One document per reporter per gift, so reporting twice changes nothing.
    const reportRef = reports().doc(`${report.giftId}_${report.reporter}`);
    return firestore().runTransaction(async (tx) => {
      const [giftSnap, reportSnap] = await Promise.all([tx.get(giftRef), tx.get(reportRef)]);
      if (!giftSnap.exists) return "not_found" as const;
      if (reportSnap.exists) return "duplicate" as const;
      tx.create(reportRef, report);
      tx.update(giftRef, { reportCount: FieldValue.increment(1) });
      return "added" as const;
    });
  },
};

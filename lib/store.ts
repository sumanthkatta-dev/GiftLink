/**
 * The only file that touches gift storage.
 *
 * Gifts live in Cloud Firestore when the Firebase env vars are set
 * (see lib/firestore-store.ts), and in a local JSON file (data/gifts.json)
 * otherwise, which is handy for local development.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeWrap, type WrapStyle } from "@/lib/wraps";
import { firestoreConfigured, firestoreStore } from "@/lib/firestore-store";
import type { ReportReason } from "@/lib/reports";

export type { WrapStyle };

export interface Gift {
  id: string;
  /** Secret that unlocks the sender's manage page. */
  manageKey: string;
  url: string;
  receiverName: string;
  senderName: string;
  note: string;
  wrapStyle: WrapStyle;
  /** ISO 8601 in UTC, or null when the gift opens straight away. */
  unlockAt: string | null;
  secretQuestion: string | null;
  /** Salted hash of the answer. The plain answer is never stored. */
  secretAnswerHash: string | null;
  ogTitle: string | null;
  ogImage: string | null;
  /** ISO 8601 in UTC. */
  createdAt: string;
  /** ISO 8601 in UTC, or null until the receiver reaches the reveal. */
  openedAt: string | null;
  /** How many different visitors reported the gift. Missing on older gifts, meaning 0. */
  reportCount?: number;
}

export type NewGift = Omit<Gift, "id" | "createdAt" | "openedAt" | "reportCount">;

/** Gifts with this many reports stop opening. */
export const TAKEDOWN_REPORTS = 3;

export function isTakenDown(gift: Pick<Gift, "reportCount">): boolean {
  return (gift.reportCount ?? 0) >= TAKEDOWN_REPORTS;
}

export interface Report {
  giftId: string;
  reason: ReportReason;
  /** ISO 8601 in UTC. */
  createdAt: string;
  /** Salted hash of the reporter's IP, so one visitor counts once. */
  reporter: string;
}

export type ReportOutcome = "added" | "duplicate" | "not_found";

export interface GiftStore {
  createGift(input: NewGift): Promise<Gift>;
  getGift(id: string): Promise<Gift | null>;
  /** Sets openedAt the first time it is called. Later calls change nothing. */
  markOpened(id: string): Promise<Gift | null>;
  /** Saves a report and counts it on the gift, once per reporter per gift. */
  addReport(report: Report): Promise<ReportOutcome>;
}

// ---------------------------------------------------------------------------
// Local JSON file implementation
// ---------------------------------------------------------------------------

const DATA_FILE = path.join(process.cwd(), "data", "gifts.json");
const REPORTS_FILE = path.join(process.cwd(), "data", "reports.json");
const ID_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;

type GiftMap = Record<string, Gift>;

/** Older gifts may hold a retired wrap name. Reads map it to a current one; the file is not rewritten. */
function withCurrentWrap(gift: Gift): Gift {
  return { ...gift, wrapStyle: normalizeWrap(gift.wrapStyle) };
}

async function readAll(): Promise<GiftMap> {
  try {
    return JSON.parse(await readFile(DATA_FILE, "utf8")) as GiftMap;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function writeAll(gifts: GiftMap): Promise<void> {
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(gifts, null, 2), "utf8");
}

async function readReports(): Promise<Report[]> {
  try {
    return JSON.parse(await readFile(REPORTS_FILE, "utf8")) as Report[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

// Writes run one at a time so two requests cannot overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

const fileStore: GiftStore = {
  createGift(input) {
    return exclusive(async () => {
      const gifts = await readAll();
      let id = randomBytes(8).toString("base64url");
      while (Object.hasOwn(gifts, id)) id = randomBytes(8).toString("base64url");
      const gift: Gift = {
        ...input,
        id,
        createdAt: new Date().toISOString(),
        openedAt: null,
      };
      gifts[id] = gift;
      await writeAll(gifts);
      return gift;
    });
  },

  async getGift(id) {
    if (!ID_PATTERN.test(id)) return null;
    await queue;
    const gifts = await readAll();
    return Object.hasOwn(gifts, id) ? withCurrentWrap(gifts[id]) : null;
  },

  markOpened(id) {
    return exclusive(async () => {
      if (!ID_PATTERN.test(id)) return null;
      const gifts = await readAll();
      if (!Object.hasOwn(gifts, id)) return null;
      const gift = gifts[id];
      if (!gift.openedAt) {
        gift.openedAt = new Date().toISOString();
        await writeAll(gifts);
      }
      return withCurrentWrap(gift);
    });
  },

  addReport(report) {
    return exclusive(async () => {
      if (!ID_PATTERN.test(report.giftId)) return "not_found";
      const gifts = await readAll();
      if (!Object.hasOwn(gifts, report.giftId)) return "not_found";
      const reports = await readReports();
      if (reports.some((r) => r.giftId === report.giftId && r.reporter === report.reporter)) return "duplicate";
      reports.push(report);
      await mkdir(path.dirname(REPORTS_FILE), { recursive: true });
      await writeFile(REPORTS_FILE, JSON.stringify(reports, null, 2), "utf8");
      const gift = gifts[report.giftId];
      gift.reportCount = (gift.reportCount ?? 0) + 1;
      await writeAll(gifts);
      return "added";
    });
  },
};

// ---------------------------------------------------------------------------
// Which store is used
// ---------------------------------------------------------------------------

// Firestore when its env vars are set (production), the local file otherwise (development).
// On Vercel the disk is read-only, so the file store can only fail there: say why in the logs.
if (!firestoreConfigured() && process.env.VERCEL) {
  console.error(
    "GiftLink: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are not set. " +
      "Gifts cannot be saved on Vercel without them.",
  );
}

const store: GiftStore = firestoreConfigured() ? firestoreStore : fileStore;

export const createGift = store.createGift;
export const getGift = store.getGift;
export const markOpened = store.markOpened;
export const addReport = store.addReport;

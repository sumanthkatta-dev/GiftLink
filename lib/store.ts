/**
 * The only file that touches gift storage.
 *
 * v1 keeps gifts in a local JSON file (data/gifts.json). To move to
 * Firestore, write another object that satisfies `GiftStore` and export
 * its methods at the bottom of this file. Nothing else needs to change.
 */
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type WrapStyle = "box" | "envelope";

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
}

export type NewGift = Omit<Gift, "id" | "createdAt" | "openedAt">;

export interface GiftStore {
  createGift(input: NewGift): Promise<Gift>;
  getGift(id: string): Promise<Gift | null>;
  /** Sets openedAt the first time it is called. Later calls change nothing. */
  markOpened(id: string): Promise<Gift | null>;
}

// ---------------------------------------------------------------------------
// Local JSON file implementation
// ---------------------------------------------------------------------------

const DATA_FILE = path.join(process.cwd(), "data", "gifts.json");
const ID_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;

type GiftMap = Record<string, Gift>;

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
    return Object.hasOwn(gifts, id) ? gifts[id] : null;
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
      return gift;
    });
  },
};

const store: GiftStore = fileStore;

export const createGift = store.createGift;
export const getGift = store.getGift;
export const markOpened = store.markOpened;

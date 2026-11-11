"use server";

import { headers } from "next/headers";
import { LIMITS } from "@/lib/limits";
import type { ErrorKey } from "@/lib/messages";
import { checkHost } from "@/lib/network";
import { fetchOg } from "@/lib/og";
import { clientIpHash, consume } from "@/lib/rate-limit";
import { isReportReason } from "@/lib/reports";
import { checkSafeBrowsing, isOwnSite, ownHosts } from "@/lib/safety";
import { answerMatches, hashAnswer, newManageKey } from "@/lib/secret";
import { addReport, createGift, getGift, isTakenDown, markOpened, type Gift } from "@/lib/store";
import { isWrapStyle } from "@/lib/wraps";

export interface CreateGiftInput {
  url: string;
  receiverName: string;
  senderName: string;
  note: string;
  wrapStyle: string;
  /** ISO 8601 in UTC, or "" for no unlock time. */
  unlockAt: string;
  secretQuestion: string;
  secretAnswer: string;
}

export type CreateField = keyof CreateGiftInput | "form";
export type CreateErrors = Partial<Record<CreateField, ErrorKey>>;

export type CreateGiftResult =
  | { ok: true; id: string; key: string }
  | { ok: false; errors: CreateErrors };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    // Names without a dot are refused, except IPv6 literals and local names,
    // which get the clearer "private address" message further on.
    const host = url.hostname.toLowerCase();
    if (!host.includes(".") && !host.startsWith("[") && host !== "localhost") return null;
    return url;
  } catch {
    return null;
  }
}

export async function createGiftAction(input: CreateGiftInput): Promise<CreateGiftResult> {
  const errors: CreateErrors = {};

  const rawUrl = text(input?.url);
  const receiverName = text(input?.receiverName);
  const senderName = text(input?.senderName);
  const note = text(input?.note);
  const wrapStyle = text(input?.wrapStyle);
  const unlockRaw = text(input?.unlockAt);
  const secretQuestion = text(input?.secretQuestion);
  const secretAnswer = text(input?.secretAnswer);

  const url = rawUrl.length <= LIMITS.url ? parseHttpsUrl(rawUrl) : null;
  if (!rawUrl) errors.url = "required";
  else if (!url) errors.url = "urlInvalid";

  if (!receiverName) errors.receiverName = "required";
  else if (receiverName.length > LIMITS.name) errors.receiverName = "tooLong";

  if (!senderName) errors.senderName = "required";
  else if (senderName.length > LIMITS.name) errors.senderName = "tooLong";

  if (note.length > LIMITS.note) errors.note = "tooLong";

  if (!isWrapStyle(wrapStyle)) errors.wrapStyle = "wrapInvalid";

  let unlockAt: string | null = null;
  if (unlockRaw) {
    const time = Date.parse(unlockRaw);
    if (Number.isNaN(time)) errors.unlockAt = "dateInvalid";
    else unlockAt = new Date(time).toISOString();
  }

  if (Boolean(secretQuestion) !== Boolean(secretAnswer)) {
    errors[secretQuestion ? "secretAnswer" : "secretQuestion"] = "secretPair";
  } else if (secretQuestion.length > LIMITS.question) {
    errors.secretQuestion = "tooLong";
  } else if (secretAnswer.length > LIMITS.answer) {
    errors.secretAnswer = "tooLong";
  }

  if (!url || !isWrapStyle(wrapStyle) || Object.keys(errors).length > 0) return { ok: false, errors };

  try {
    // Every attempt that gets this far counts, so the checks below can't be probed endlessly.
    const limit = await consume("create", await clientIpHash());
    if (!limit.allowed) return { ok: false, errors: { form: "rateLimited" } };

    const requestHeaders = await headers();
    const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
    if (isOwnSite(url, ownHosts(requestHost))) return { ok: false, errors: { url: "urlSelf" } };

    // A host that doesn't resolve is allowed: it may be a DNS hiccup, and nothing is fetched from it.
    if ((await checkHost(url.hostname)) === "private") return { ok: false, errors: { url: "urlPrivate" } };

    if ((await checkSafeBrowsing(url.toString())) === "unsafe") {
      console.warn(`GiftLink: refused a link flagged by Safe Browsing (${url.hostname})`);
      return { ok: false, errors: { url: "urlUnsafe" } };
    }

    const og = await fetchOg(url.toString());
    const gift = await createGift({
      manageKey: newManageKey(),
      url: url.toString(),
      receiverName,
      senderName,
      note,
      wrapStyle,
      unlockAt,
      secretQuestion: secretQuestion || null,
      secretAnswerHash: secretAnswer ? hashAnswer(secretAnswer) : null,
      ogTitle: og.title,
      ogImage: og.image,
    });
    return { ok: true, id: gift.id, key: gift.manageKey };
  } catch (error) {
    console.error("createGift failed", error);
    return { ok: false, errors: { form: "generic" } };
  }
}

type AnswerVerdict = "correct" | "wrong" | "limited";

/**
 * Every attempt is counted before the answer is checked, so a burst of
 * guesses can't slip past the limit. A correct answer hands its attempt back:
 * only wrong answers use up the 10 per hour.
 */
async function verifyAnswer(gift: Gift, answer: string): Promise<AnswerVerdict> {
  if (!gift.secretAnswerHash) return "correct";
  const limit = await consume("answer", `${gift.id}_${await clientIpHash()}`);
  if (!limit.allowed) return "limited";
  if (answerMatches(text(answer).slice(0, 500), gift.secretAnswerHash)) {
    await limit.release();
    return "correct";
  }
  return "wrong";
}

export type AnswerResult = { status: AnswerVerdict | "not_found" | "taken_down" };

/** Checks the secret answer without revealing anything about the gift. */
export async function checkAnswerAction(id: string, answer: string): Promise<AnswerResult> {
  const gift = await getGift(text(id));
  if (!gift) return { status: "not_found" };
  if (isTakenDown(gift)) return { status: "taken_down" };
  return { status: await verifyAnswer(gift, answer) };
}

export interface RevealedGift {
  url: string;
  note: string;
  ogTitle: string | null;
  ogImage: string | null;
}

export type RevealResult =
  | { status: "ok"; gift: RevealedGift }
  | { status: "locked"; serverNow: number }
  | { status: "wrong_answer" }
  | { status: "limited" }
  | { status: "taken_down" }
  | { status: "not_found" };

/**
 * The only way the wrapped URL and note reach the browser. The unlock time
 * and the secret answer are enforced here, on the server, so neither can be
 * skipped by reading the page source.
 */
export async function revealGiftAction(id: string, answer: string): Promise<RevealResult> {
  const gift = await getGift(text(id));
  if (!gift) return { status: "not_found" };
  if (isTakenDown(gift)) return { status: "taken_down" };

  if (gift.unlockAt && Date.parse(gift.unlockAt) > Date.now()) {
    return { status: "locked", serverNow: Date.now() };
  }

  const verdict = await verifyAnswer(gift, answer);
  if (verdict === "limited") return { status: "limited" };
  if (verdict === "wrong") return { status: "wrong_answer" };

  await markOpened(gift.id);
  return {
    status: "ok",
    gift: { url: gift.url, note: gift.note, ogTitle: gift.ogTitle, ogImage: gift.ogImage },
  };
}

export type ReportResult = { ok: boolean };

/** Saves a report. Each visitor counts once per gift; enough reports take the gift down. */
export async function reportGiftAction(id: string, reason: string): Promise<ReportResult> {
  const giftId = text(id);
  if (!isReportReason(reason)) return { ok: false };
  try {
    const reporter = await clientIpHash();
    const limit = await consume("report", reporter);
    if (!limit.allowed) return { ok: false };
    const outcome = await addReport({ giftId, reason, reporter, createdAt: new Date().toISOString() });
    // A repeat report from the same visitor still gets a thank-you: nothing to fix on their side.
    return { ok: outcome !== "not_found" };
  } catch (error) {
    console.error("reportGift failed", error);
    return { ok: false };
  }
}

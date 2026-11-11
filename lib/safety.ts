/**
 * Checks a link before it is wrapped.
 *
 * Google Safe Browsing is asked whether the URL is known malware, phishing or
 * unwanted software. If Google can't answer (no key, an error, or no reply
 * within 3 seconds) the link is allowed and a warning is logged: real people
 * must never be blocked because Google is slow.
 */
import "server-only";

const SAFE_BROWSING_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find";
const TIMEOUT_MS = 3000;
const THREAT_TYPES = ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"];

export type SafetyVerdict = "safe" | "unsafe" | "unknown";

let warnedMissingKey = false;

/** "unsafe" only when Google positively flags the URL. */
export async function checkSafeBrowsing(url: string): Promise<SafetyVerdict> {
  const key = process.env.GOOGLE_SAFE_BROWSING_API_KEY?.trim();
  if (!key) {
    if (!warnedMissingKey) {
      console.warn("GiftLink: GOOGLE_SAFE_BROWSING_API_KEY is not set, so links are not checked for malware or phishing.");
      warnedMissingKey = true;
    }
    return "unknown";
  }

  try {
    const response = await fetch(`${SAFE_BROWSING_URL}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "giftlink", clientVersion: "1.0.0" },
        threatInfo: {
          threatTypes: THREAT_TYPES,
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }],
        },
      }),
    });
    if (!response.ok) {
      console.warn(`GiftLink: Safe Browsing check failed with HTTP ${response.status}; allowing the link.`);
      return "unknown";
    }
    // An empty object means no match.
    const data = (await response.json()) as { matches?: unknown[] };
    return Array.isArray(data.matches) && data.matches.length > 0 ? "unsafe" : "safe";
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "timed out" : "failed";
    console.warn(`GiftLink: Safe Browsing check ${reason}; allowing the link.`, error instanceof Error ? error.message : "");
    return "unknown";
  }
}

function bareHost(value: string): string {
  return value.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "").replace(/^www\./, "");
}

/**
 * Every hostname GiftLink itself is served on: the configured site URL,
 * Vercel's deployment hostnames, and the host the current request came in on.
 */
export function ownHosts(requestHost: string | null): Set<string> {
  const hosts = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (!value) return;
    try {
      hosts.add(bareHost(value.includes("://") ? new URL(value).host : value));
    } catch {
      // Not a usable host: ignore it.
    }
  };
  add(process.env.NEXT_PUBLIC_SITE_URL);
  add(process.env.VERCEL_URL);
  add(process.env.VERCEL_BRANCH_URL);
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  add(requestHost);
  hosts.delete("");
  return hosts;
}

/** True when the URL points at GiftLink itself (no wrapping a GiftLink inside a GiftLink). */
export function isOwnSite(url: URL, hosts: Set<string>): boolean {
  return hosts.has(bareHost(url.host));
}

/**
 * Fetches a page's og:title and og:image on the server.
 * Never throws: a page that cannot be read just has no preview.
 *
 * The URL comes from a stranger, so the fetch is fenced in:
 * - https on the standard port only, no user:password in the address
 * - every hostname is resolved first and refused if any address is private,
 *   loopback, link-local or a cloud metadata service (lib/network.ts)
 * - the connection itself uses a lookup that applies the same check, so a
 *   hostname can't pass the check and then resolve somewhere else (DNS rebinding)
 * - redirects are followed by hand, at most 3, each one checked again
 * - 5 seconds in total, at most 512 KB read, and only text/html is parsed
 */
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import type { IncomingMessage } from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { checkHost, isBlockedAddress } from "@/lib/network";

export interface OgData {
  title: string | null;
  image: string | null;
}

const MAX_REDIRECTS = 3;
const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 5000;
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

/** Resolves like the default lookup, but refuses to connect to a blocked address. */
const guardedLookup = ((hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
  dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error);
    if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
      return callback(Object.assign(new Error(`Refused to connect to ${hostname}`), { code: "EBLOCKED" }));
    }
    if (options?.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}) as unknown as LookupFunction;

/** https, standard port, no credentials, and a public host. */
async function isSafeTarget(url: URL): Promise<boolean> {
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return false;
  return (await checkHost(url.hostname)) === "public";
}

function get(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        lookup: guardedLookup,
        signal,
        agent: false,
        headers: {
          "user-agent": "GiftLinkBot/1.0 (link preview)",
          accept: "text/html",
        },
      },
      resolve,
    );
    request.on("error", reject);
  });
}

async function readStart(response: IncomingMessage): Promise<string> {
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  try {
    for await (const chunk of response as AsyncIterable<Buffer>) {
      const room = MAX_BYTES - bytes;
      const piece = chunk.byteLength > room ? chunk.subarray(0, room) : chunk;
      bytes += piece.byteLength;
      html += decoder.decode(piece, { stream: true });
      if (bytes >= MAX_BYTES || html.includes("</head>")) break;
    }
  } finally {
    response.destroy();
  }
  return html;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function metaContent(html: string, key: string): string | null {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(/([a-z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
    }
    const name = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (name === key && attrs.content) return decodeEntities(attrs.content).trim();
  }
  return null;
}

/** The preview image is loaded by the receiver's browser, so it gets the same address rules. */
async function safeImage(raw: string | null, base: URL): Promise<string | null> {
  if (!raw) return null;
  try {
    const image = new URL(raw, base);
    if (image.toString().length > 2000) return null;
    return (await isSafeTarget(image)) ? image.toString() : null;
  } catch {
    return null;
  }
}

export async function fetchOg(target: string): Promise<OgData> {
  const empty: OgData = { title: null, image: null };
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    let url = new URL(target);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await isSafeTarget(url))) return empty;
      const response = await get(url, signal);
      const status = response.statusCode ?? 0;
      const location = response.headers.location;

      if (REDIRECT_CODES.has(status) && location) {
        response.destroy();
        url = new URL(location, url);
        continue;
      }
      const type = (response.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      if (status < 200 || status >= 300 || type !== "text/html") {
        response.destroy();
        return empty;
      }

      const html = await readStart(response);
      const rawTitle =
        metaContent(html, "og:title") ??
        metaContent(html, "twitter:title") ??
        decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
      const rawImage =
        metaContent(html, "og:image:secure_url") ??
        metaContent(html, "og:image") ??
        metaContent(html, "twitter:image");

      return { title: rawTitle ? rawTitle.slice(0, 200) : null, image: await safeImage(rawImage, url) };
    }
    return empty;
  } catch {
    return empty;
  }
}

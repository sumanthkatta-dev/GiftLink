/**
 * Fetches a page's og:title and og:image on the server.
 * Never throws: a page that cannot be read just has no preview.
 */
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

export interface OgData {
  title: string | null;
  image: string | null;
}

const MAX_REDIRECTS = 4;
const MAX_BYTES = 400_000;
const TIMEOUT_MS = 6000;

// The server must not be usable to probe private networks.
const blocked = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["224.0.0.0", 3],
] as const) {
  blocked.addSubnet(net, bits, "ipv4");
}
blocked.addAddress("::", "ipv6");
blocked.addAddress("::1", "ipv6");
blocked.addSubnet("fc00::", 7, "ipv6");
blocked.addSubnet("fe80::", 10, "ipv6");

function isBlockedAddress(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return blocked.check(mapped[1], "ipv4");
  return blocked.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

async function isPublicHttps(url: URL): Promise<boolean> {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return !isBlockedAddress(host);
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every((a) => !isBlockedAddress(a.address));
  } catch {
    return false;
  }
}

async function readStart(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  while (bytes < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    html += decoder.decode(value, { stream: true });
    if (html.includes("</head>")) break;
  }
  await reader.cancel().catch(() => undefined);
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

export async function fetchOg(target: string): Promise<OgData> {
  const empty: OgData = { title: null, image: null };
  try {
    let url = new URL(target);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await isPublicHttps(url))) return empty;
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": "GiftLinkBot/1.0 (link preview)",
          accept: "text/html,application/xhtml+xml",
        },
      });

      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        url = new URL(location, url);
        continue;
      }
      if (!response.ok) return empty;
      if (!(response.headers.get("content-type") ?? "").includes("html")) return empty;

      const html = await readStart(response);
      const rawTitle =
        metaContent(html, "og:title") ??
        metaContent(html, "twitter:title") ??
        decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
      const rawImage =
        metaContent(html, "og:image:secure_url") ??
        metaContent(html, "og:image") ??
        metaContent(html, "twitter:image");

      let image: string | null = null;
      if (rawImage) {
        try {
          const resolved = new URL(rawImage, url);
          if (resolved.protocol === "https:") image = resolved.toString();
        } catch {
          // Unusable image URL: keep the title, drop the image.
        }
      }
      return { title: rawTitle ? rawTitle.slice(0, 200) : null, image };
    }
    return empty;
  } catch {
    return empty;
  }
}

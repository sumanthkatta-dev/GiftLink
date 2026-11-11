/**
 * Decides whether an address is on the public internet.
 * Used before the server fetches anything a user gave it (lib/og.ts) and
 * before a link is wrapped (app/actions.ts), so GiftLink can't be used to
 * reach private networks, the machine itself, or cloud metadata services.
 */
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT, also Alibaba Cloud metadata (100.100.100.200)
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, AWS/GCP/Azure metadata (169.254.169.254)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 3], // multicast, reserved, broadcast
] as const) {
  blocked.addSubnet(net, bits, "ipv4");
}
for (const [net, bits] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["64:ff9b::", 96], // NAT64, can reach private IPv4
  ["64:ff9b:1::", 48], // local NAT64
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4, can embed private IPv4
  ["fc00::", 7], // unique local, includes AWS metadata fd00:ec2::254
  ["fe80::", 10], // link-local
  ["fec0::", 10], // old site-local
  ["ff00::", 8], // multicast
] as const) {
  blocked.addSubnet(net, bits, "ipv6");
}

/** True for any address GiftLink must never connect to. Unparseable input counts as blocked. */
export function isBlockedAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").toLowerCase();
  // IPv4-mapped IPv6 (::ffff:127.0.0.1, ::ffff:7f00:1) is checked against the
  // IPv4 rules by BlockList itself. Don't add ::ffff:0:0/96 here: BlockList
  // would then match every plain IPv4 address against it.
  const family = isIP(ip);
  if (family === 4) return blocked.check(ip, "ipv4");
  if (family === 6) return blocked.check(ip, "ipv6");
  return true;
}

/** Hostnames that are always local, whatever DNS says. */
function isLocalName(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata" ||
    host === "metadata.google.internal"
  );
}

export type HostVerdict = "public" | "private" | "unresolved";

/**
 * Looks up a URL hostname. "private" if it is, or resolves to, any blocked
 * address. "unresolved" if DNS gave no answer (the caller decides what that means).
 */
export async function checkHost(hostname: string): Promise<HostVerdict> {
  const host = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!host) return "private";
  if (isIP(host)) return isBlockedAddress(host) ? "private" : "public";
  if (isLocalName(host)) return "private";
  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (addresses.length === 0) return "unresolved";
    return addresses.some((a) => isBlockedAddress(a.address)) ? "private" : "public";
  } catch {
    return "unresolved";
  }
}

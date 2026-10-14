// Fetches a web page the user pasted, for recipe import. Because the server
// fetches it, the address is checked first: public http(s) only, never
// private/internal network addresses (also re-checked on every redirect),
// with a time and size limit.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 12000;

export class FetchPageError extends Error {}

/** True for loopback, private, link-local, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast and reserved
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7)); // IPv4-mapped
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") || // unique local
    /^fe[89ab]/.test(v6) || // link-local
    v6.startsWith("ff") // multicast
  );
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new FetchPageError("Only web links (http or https) can be imported.");
  }
  if (url.username || url.password) throw new FetchPageError("That link can't be imported.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new FetchPageError("That link can't be imported.");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new FetchPageError("Couldn't find that website. Check the link.");
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new FetchPageError("That link can't be imported.");
}

/** Returns the page's HTML and final URL, or throws FetchPageError with a message for the user. */
export async function fetchPage(rawUrl: string): Promise<{ html: string; url: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new FetchPageError("That doesn't look like a link. Copy the full address, starting with https://");
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; FoodPlannerRecipeImport/1.0)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
    } catch {
      throw new FetchPageError("Couldn't reach that website. Try again, or paste the recipe text instead.");
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) {
      throw new FetchPageError(
        res.status === 401 || res.status === 403 || res.status === 429
          ? "That website blocked the import (it may need a login). Paste the recipe text instead."
          : `That page couldn't be loaded (error ${res.status}).`,
      );
    }
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) throw new FetchPageError("That link isn't a web page.");

    // Read at most MAX_BYTES.
    const reader = res.body?.getReader();
    if (!reader) throw new FetchPageError("That page was empty.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    return { html: new TextDecoder().decode(Buffer.concat(chunks)), url: url.toString() };
  }
  throw new FetchPageError("That link redirects too many times.");
}

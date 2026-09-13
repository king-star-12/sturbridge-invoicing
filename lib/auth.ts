export const authCookieName = "shh_session";

export function passcode(): string {
  return process.env.INVOICE_PASSCODE || "host2026";
}

/** Cookie holds a SHA-256 of the passcode + a static salt, so the passcode itself never leaves the server. Edge-runtime safe. */
export async function expectedCookieValue(): Promise<string> {
  const data = new TextEncoder().encode(`shh-invoicing::${passcode()}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

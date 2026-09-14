export const authCookieName = "shh_session";
export type Role = "admin" | "staff";

export function passcodes(): { admin: string; staff: string } {
  return { admin: process.env.INVOICE_PASSCODE || "host2026", staff: process.env.STAFF_PASSCODE || "" };
}

async function sha(text: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** Cookie value: "<role>.<sha256(role + passcode)>" — the passcode never leaves the server. */
export async function cookieFor(role: Role): Promise<string> {
  const pc = passcodes();
  return `${role}.${await sha(`shh-invoicing::${role}::${role === "admin" ? pc.admin : pc.staff}`)}`;
}
export async function roleFromCookie(value: string | undefined): Promise<Role | null> {
  if (!value) return null;
  if (value === (await cookieFor("admin"))) return "admin";
  if (passcodes().staff && value === (await cookieFor("staff"))) return "staff";
  return null;
}

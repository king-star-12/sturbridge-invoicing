import { NextResponse } from "next/server";
import { authCookieName, cookieFor, passcodes } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { passcode?: string };
  const pc = passcodes();
  const role = body.passcode && body.passcode === pc.admin ? "admin" : body.passcode && pc.staff && body.passcode === pc.staff ? "staff" : null;
  if (!role) return NextResponse.json({ ok: false, error: "That passcode isn't right." }, { status: 401 });
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(authCookieName, await cookieFor(role), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
  res.cookies.set("shh_role", role, { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
  return res;
}

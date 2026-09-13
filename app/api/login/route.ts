import { NextResponse } from "next/server";
import { authCookieName, expectedCookieValue, passcode } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { passcode?: string };
  if (!body.passcode || body.passcode !== passcode()) {
    return NextResponse.json({ ok: false, error: "That passcode isn't right." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(authCookieName, await expectedCookieValue(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
  return res;
}

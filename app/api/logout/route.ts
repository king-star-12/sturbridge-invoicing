import { NextResponse } from "next/server";
import { authCookieName } from "@/lib/auth";
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(authCookieName, "", { path: "/", maxAge: 0 });
  return res;
}

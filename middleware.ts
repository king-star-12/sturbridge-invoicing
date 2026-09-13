import { NextResponse, type NextRequest } from "next/server";
import { authCookieName, expectedCookieValue } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login") || pathname.startsWith("/_next") || pathname === "/logo.png" || pathname === "/favicon.ico") return NextResponse.next();
  const cookie = req.cookies.get(authCookieName)?.value;
  if (cookie && cookie === (await expectedCookieValue())) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };

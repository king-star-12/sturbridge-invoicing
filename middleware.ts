import { NextResponse, type NextRequest } from "next/server";
import { authCookieName, roleFromCookie } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login") || pathname.startsWith("/_next") || pathname === "/logo.png" || pathname === "/favicon.ico") return NextResponse.next();
  const role = await roleFromCookie(req.cookies.get(authCookieName)?.value);
  if (role) {
    const res = NextResponse.next();
    res.headers.set("x-role", role);
    return res;
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };

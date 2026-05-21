import { NextResponse, type NextRequest } from "next/server";
import {
  isSiteGateEnabled,
  SITE_GATE_COOKIE_NAME,
  verifySiteGateCookieValue,
} from "./lib/site-gate";

const publicFilePattern = /\.(?:avif|css|gif|ico|jpg|jpeg|js|map|png|svg|txt|webp|woff|woff2)$/i;

function isAlwaysAllowed(pathname: string) {
  return (
    pathname === "/site-login" ||
    pathname.startsWith("/api/site-gate/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    publicFilePattern.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  if (!isSiteGateEnabled() || isAlwaysAllowed(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(SITE_GATE_COOKIE_NAME)?.value;
  const hasGateSession = await verifySiteGateCookieValue(cookieValue);
  if (hasGateSession) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/site-login";
  loginUrl.search = "";
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

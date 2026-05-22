import { NextResponse, type NextRequest } from "next/server";
import {
  createSiteGateCookieValue,
  getSafeNextPath,
  getSiteGateUsername,
  isSiteGateEnabled,
  SITE_GATE_COOKIE_NAME,
  SITE_GATE_MAX_AGE_SECONDS,
  verifySiteGateCredentials,
} from "../../../../lib/site-gate";

function getRequestOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin?.startsWith("http://") || origin?.startsWith("https://")) {
    return origin;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {}
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = getSafeNextPath(String(formData.get("next") ?? "/"));
  const requestOrigin = getRequestOrigin(request);
  const targetUrl = new URL(nextPath, requestOrigin);

  if (!isSiteGateEnabled()) {
    return NextResponse.redirect(targetUrl, 303);
  }

  const valid = await verifySiteGateCredentials(username, password);
  if (!valid) {
    const loginUrl = new URL("/site-login", requestOrigin);
    loginUrl.searchParams.set("error", "1");
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl, 303);
  }

  const response = NextResponse.redirect(targetUrl, 303);
  response.cookies.set({
    httpOnly: true,
    maxAge: SITE_GATE_MAX_AGE_SECONDS,
    name: SITE_GATE_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: await createSiteGateCookieValue(getSiteGateUsername()),
  });

  return response;
}

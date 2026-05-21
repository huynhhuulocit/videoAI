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

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = getSafeNextPath(String(formData.get("next") ?? "/"));
  const targetUrl = new URL(nextPath, request.url);

  if (!isSiteGateEnabled()) {
    return NextResponse.redirect(targetUrl, 303);
  }

  const valid = await verifySiteGateCredentials(username, password);
  if (!valid) {
    const loginUrl = new URL("/site-login", request.url);
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

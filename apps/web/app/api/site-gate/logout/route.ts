import { NextResponse, type NextRequest } from "next/server";
import { SITE_GATE_COOKIE_NAME } from "../../../../lib/site-gate";

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
  const response = NextResponse.redirect(new URL("/site-login", getRequestOrigin(request)), 303);
  response.cookies.set({
    httpOnly: true,
    maxAge: 0,
    name: SITE_GATE_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: "",
  });

  return response;
}

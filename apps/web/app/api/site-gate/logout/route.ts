import { NextResponse, type NextRequest } from "next/server";
import { SITE_GATE_COOKIE_NAME } from "../../../../lib/site-gate";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/site-login", request.url), 303);
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

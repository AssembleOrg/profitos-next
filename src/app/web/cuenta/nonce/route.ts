import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { NONCE_COOKIE } from "@/lib/web/server/visitor-session";

export async function GET() {
  const nonce = randomBytes(24).toString("base64url");
  const response = NextResponse.json({ nonce }, { headers: { "cache-control": "no-store" } });
  response.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.WEB_INSECURE_COOKIES !== "1",
    sameSite: "lax",
    path: "/web/cuenta",
    maxAge: 600,
  });
  return response;
}

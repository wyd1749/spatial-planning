import { NextResponse } from "next/server"
import { clearSession } from "@/lib/auth"

// Single route handler for /logout: clears the session and redirects to sign-in
// on the SAME site the user is on (never a hard-coded URL).
export async function GET(request: Request) {
  await clearSession()
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  const proto = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "")
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin
  return NextResponse.redirect(new URL("/", origin))
}

import { NextResponse } from "next/server"
import { clearSession, currentUser } from "@/lib/auth"
import { db } from "@/lib/supabase"

// Single route handler for /logout: marks the user offline, clears the session and redirects
// to sign-in on the SAME site the user is on (never a hard-coded URL).
export async function GET(request: Request) {
  try {
    const user = await currentUser()
    if (user) await db().from("staff_presence").delete().eq("user_id", user.id)
  } catch (e) { console.error("presence cleanup on logout failed:", e) } // never block the logout
  await clearSession()
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  const proto = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "")
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin
  return NextResponse.redirect(new URL("/", origin))
}

import { NextResponse } from "next/server"
import { clearSession, currentUser } from "@/lib/auth"
import { db } from "@/lib/supabase"

export async function POST() {
  try {
    const user = await currentUser()
    if (user) await db().from("staff_presence").delete().eq("user_id", user.id)
  } catch (e) { console.error("presence cleanup on logout failed:", e) } // never block the logout
  await clearSession()
  return NextResponse.json({ ok: true })
}

import { NextResponse } from "next/server"
import { currentUser } from "@/lib/auth"
import { db } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// Staff seen in the last 60 seconds. Names stay behind the login - they never travel over the public live channel.
async function online() {
  const since = new Date(Date.now() - 60_000).toISOString()
  const { data, error } = await db().from("staff_presence").select("user_id,name,role").gte("last_seen", since).order("name")
  if (error) { console.error("presence read failed:", error.message); return [] }
  return (data ?? []).map(r => ({ id: r.user_id as string, name: r.name as string, role: r.role as string }))
}

// Heartbeat: the browser calls this every ~20s while a page is open.
export async function POST() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { error } = await db().from("staff_presence").upsert({ user_id: user.id, name: user.name, role: user.role, last_seen: new Date().toISOString() })
  if (error) console.error("presence write failed (has migration-003 been run?):", error.message)
  return NextResponse.json({ online: await online() })
}

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ online: await online() })
}

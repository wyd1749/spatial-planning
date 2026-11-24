import { NextResponse } from "next/server"
import { currentUser } from "@/lib/auth"
import { db } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// Full audit trail, newest first, paged: ?offset=0&limit=200&q=search  (limit max 1000 = Supabase's per-request cap)
export async function GET(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0)
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit")) || 200))
  const q = (url.searchParams.get("q") || "").replace(/[%_\\",()*]/g, " ").trim()

  let query = db().from("activities").select("id,user_name,action,application,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + limit - 1)
  if (q) query = query.or(["user_name", "action", "application"].map(c => `${c}.ilike."%${q}%"`).join(","))
  const { data, error, count } = await query
  if (error) { console.error("audit trail read failed:", error.message); return NextResponse.json({ error: "Could not load the audit trail." }, { status: 500 }) }
  return NextResponse.json({
    activity: (data ?? []).map(a => ({ id: a.id, user: a.user_name, action: a.action, application: a.application ?? undefined, createdAt: a.created_at })),
    total: count ?? 0,
  })
}

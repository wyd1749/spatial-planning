import { NextResponse } from "next/server"
import { currentUser } from "@/lib/auth"
import { listActivities } from "@/lib/store"

export async function GET() {
  const u = await currentUser()
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try { return NextResponse.json({ activity: await listActivities() }) }
  catch { return NextResponse.json({ error: "Could not load activity." }, { status: 500 }) }
}

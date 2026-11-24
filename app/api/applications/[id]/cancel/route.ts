import { NextResponse } from "next/server"
import { currentUser } from "@/lib/auth"
import { addNote, canAccess, getApplication, logActivity, updateApplication } from "@/lib/store"

type Ctx = { params: Promise<{ id: string }> }
const CLOSED = ["Approved", "Rejected", "Cancelled"]

// POST { action: "cancel", reason }  -> status becomes "Cancelled" (reason required)
// POST { action: "reopen", reason? } -> status goes back to "In progress"
// The application is never deleted; a case note and an activity-log entry record who did it and why.
export async function POST(req: Request, { params }: Ctx) {
  const u = await currentUser(); if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (u.role !== "Management") return NextResponse.json({ error: "Only Management can cancel or reopen applications." }, { status: 403 })
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const reason = typeof body.reason === "string" ? body.reason.trim() : ""
    const app = await getApplication(id)
    if (!app || !canAccess(u, app)) return NextResponse.json({ error: "Application not found" }, { status: 404 })

    if (body.action === "reopen") {
      if (app.status !== "Cancelled") return NextResponse.json({ error: "Only cancelled applications can be reopened." }, { status: 400 })
      await updateApplication(app.id, { status: "In progress", decision: "" })
      await addNote(app.id, reason ? `Application reopened. Reason: ${reason}` : "Application reopened.", u.name)
      await logActivity(u.name, "reopened a cancelled application", app.reference)
    } else if (body.action === "cancel") {
      if (!reason) return NextResponse.json({ error: "A reason is required to cancel an application." }, { status: 400 })
      if (reason.length > 1000) return NextResponse.json({ error: "Reason is too long (max 1000 characters)." }, { status: 400 })
      if (CLOSED.includes(app.status)) return NextResponse.json({ error: `This application is already ${app.status.toLowerCase()}.` }, { status: 400 })
      await updateApplication(app.id, { status: "Cancelled", decision: `Cancelled: ${reason}` })
      await addNote(app.id, `Application cancelled. Reason: ${reason}`, u.name)
      await logActivity(u.name, "cancelled an application", app.reference)
    } else {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 })
    }
    return NextResponse.json({ application: await getApplication(app.id) })
  } catch { return NextResponse.json({ error: "Could not update the application." }, { status: 500 }) }
}

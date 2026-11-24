import { NextResponse } from "next/server"
import { currentUser } from "@/lib/auth"
import { canAccess, deleteApplication, getApplication, InvalidDateError, logActivity, updateApplication } from "@/lib/store"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const u = await currentUser(); if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { id } = await params
    const app = await getApplication(id)
    return app && canAccess(u, app) ? NextResponse.json({ application: app }) : NextResponse.json({ error: "Application not found" }, { status: 404 })
  } catch { return NextResponse.json({ error: "Could not load application." }, { status: 500 }) }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const u = await currentUser(); if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (u.role !== "Management") return NextResponse.json({ error: "Only Management can update application status or stage." }, { status: 403 })
  try {
    const { id } = await params
    const result = await updateApplication(id, await req.json())
    if (!result) return NextResponse.json({ error: "Application not found" }, { status: 404 })
    await logActivity(u.name, "updated application details", result.reference)
    return NextResponse.json({ application: result })
  } catch (e) {
    if (e instanceof InvalidDateError) return NextResponse.json({ error: "Invalid due date." }, { status: 400 })
    return NextResponse.json({ error: "Could not update application." }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const u = await currentUser(); if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (u.role !== "Management") return NextResponse.json({ error: "Only Management can archive applications." }, { status: 403 })
  try {
    const { id } = await params
    const app = await deleteApplication(id)
    if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 })
    await logActivity(u.name, "archived an application", app.reference)
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: "Could not archive application." }, { status: 500 }) }
}

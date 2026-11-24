import { NextResponse } from "next/server"
import { currentUser } from "@/lib/auth"
import { addConsultation, canAccess, getApplication, listConsultations, logActivity } from "@/lib/store"

export async function GET() {
  const u = await currentUser(); if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try { return NextResponse.json({ consultations: await listConsultations(u) }) }
  catch { return NextResponse.json({ error: "Could not load consultations." }, { status: 500 }) }
}

export async function POST(req: Request) {
  const u = await currentUser(); if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const b = await req.json()
    if (!b.applicationId || !b.stakeholder || !b.response) return NextResponse.json({ error: "Application, stakeholder and response are required." }, { status: 400 })
    const app = await getApplication(String(b.applicationId))
    if (!app || !canAccess(u, app)) return NextResponse.json({ error: "Application not found" }, { status: 404 })
    const item = await addConsultation(app.id, String(b.stakeholder), String(b.response))
    await logActivity(u.name, "added consultation response", app.reference)
    return NextResponse.json({ item, reference: app.reference }, { status: 201 })
  } catch { return NextResponse.json({ error: "Could not save consultation response." }, { status: 500 }) }
}

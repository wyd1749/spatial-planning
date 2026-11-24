import { NextResponse } from "next/server"
import { currentUser } from "@/lib/auth"
import { createApplication, InvalidDateError, listApplications, logActivity } from "@/lib/store"

const allowedTypes = ["Subdivision", "Special consent", "Change of use", "New development", "Other"]

export async function GET(req: Request) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const url = new URL(req.url)
    const status = url.searchParams.get("status")
    const q = (url.searchParams.get("q") || "").toLowerCase()
    const apps = await listApplications({ forUser: user, status: status || undefined, q })
    return NextResponse.json({ applications: apps, total: apps.length })
  } catch { return NextResponse.json({ error: "Could not load applications." }, { status: 500 }) }
}

export async function POST(req: Request) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role === "Senior officer") return NextResponse.json({ error: "Senior officer account is not used for application registration." }, { status: 403 })
  try {
    const b = await req.json()
    if (![b.applicant, b.type, b.stand].every((v: any) => typeof v === "string" && v.trim())) return NextResponse.json({ error: "Applicant, application type and property details are required." }, { status: 400 })
    if (!allowedTypes.includes(b.type)) return NextResponse.json({ error: "Invalid application type." }, { status: 400 })
    const app = await createApplication({
      applicant: b.applicant, type: b.type, stand: b.stand, email: b.email, phone: b.phone, due: b.due, description: b.description,
      officer: user.role === "Planning officer" ? user.name : (b.officer || "Unassigned"),
    })
    await logActivity(user.name, "registered a new application", app.reference)
    return NextResponse.json({ application: app }, { status: 201 })
  } catch (e) {
    if (e instanceof InvalidDateError) return NextResponse.json({ error: "Invalid due date." }, { status: 400 })
    return NextResponse.json({ error: "Failed to save application." }, { status: 500 })
  }
}

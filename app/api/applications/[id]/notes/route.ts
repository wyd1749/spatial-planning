import { NextResponse } from "next/server"
import { currentUser } from "@/lib/auth"
import { addNote, canAccess, getApplication, logActivity } from "@/lib/store"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser(); if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { id } = await params
    const { text } = await req.json()
    if (typeof text !== "string" || !text.trim()) return NextResponse.json({ error: "Note cannot be empty." }, { status: 400 })
    const app = await getApplication(id)
    if (!app || !canAccess(u, app)) return NextResponse.json({ error: "Application not found" }, { status: 404 })
    await addNote(app.id, text, u.name)
    await logActivity(u.name, "added a case note", app.reference)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch { return NextResponse.json({ error: "Could not save note." }, { status: 500 }) }
}

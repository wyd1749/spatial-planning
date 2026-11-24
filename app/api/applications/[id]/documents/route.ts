import { NextResponse } from "next/server"
import { currentUser } from "@/lib/auth"
import { addDocument, canAccess, getApplication, logActivity } from "@/lib/store"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser(); if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { id } = await params
    const { name, description } = await req.json()
    if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "Document name is required." }, { status: 400 })
    const app = await getApplication(id)
    if (!app || !canAccess(u, app)) return NextResponse.json({ error: "Application not found" }, { status: 404 })
    await addDocument(app.id, name, typeof description === "string" ? description : "")
    await logActivity(u.name, "registered a document", app.reference)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch { return NextResponse.json({ error: "Could not register document." }, { status: 500 }) }
}

import { NextResponse } from "next/server"
import { createUser, currentUser, deleteUser, EmailExistsError, findUserByEmail, hashPassword, readUsers, updateUser, type UserRole } from "@/lib/auth"
import { logActivity } from "@/lib/store"

const roles: UserRole[] = ["Senior officer", "Management", "Planning officer"]
const strip = ({ passwordHash, passwordSalt, ...safe }: any) => safe

export async function GET() {
  const actor = await currentUser(); if (!actor || actor.role !== "Senior officer") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try { return NextResponse.json({ users: (await readUsers()).map(strip) }) }
  catch { return NextResponse.json({ error: "Could not load users." }, { status: 500 }) }
}

export async function POST(req: Request) {
  const actor = await currentUser(); if (!actor || actor.role !== "Senior officer") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { name, email, role, password } = await req.json()
    if (![name, email, role, password].every(v => typeof v === "string" && v.trim())) return NextResponse.json({ error: "All fields are required." }, { status: 400 })
    if (!roles.includes(role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    if (await findUserByEmail(email)) return NextResponse.json({ error: "Email already exists." }, { status: 409 })
    const credential = hashPassword(password)
    const user = await createUser({ name, email, role, passwordSalt: credential.salt, passwordHash: credential.hash })
    await logActivity(actor.name, "created staff account", user.email)
    return NextResponse.json({ user: strip(user) }, { status: 201 })
  } catch (e) {
    if (e instanceof EmailExistsError) return NextResponse.json({ error: "Email already exists." }, { status: 409 })
    return NextResponse.json({ error: "Could not create user." }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const actor = await currentUser(); if (!actor || actor.role !== "Senior officer") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { id, role, status } = await req.json()
    const patch: { role?: UserRole; status?: "Active" | "Setup pending" } = {}
    if (role !== undefined) { if (!roles.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 }); patch.role = role }
    if (status !== undefined) {
      if (!["Active", "Setup pending"].includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      if (id === actor.id && status !== "Active") return NextResponse.json({ error: "You cannot disable your own account." }, { status: 400 })
      patch.status = status
    }
    const user = await updateUser(id, patch)
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
    await logActivity(actor.name, "updated staff account", user.email)
    return NextResponse.json({ user: strip(user) })
  } catch { return NextResponse.json({ error: "Unable to update account" }, { status: 500 }) }
}

export async function DELETE(req: Request) {
  const actor = await currentUser(); if (!actor || actor.role !== "Senior officer") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { id } = await req.json()
    if (id === actor.id) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 })
    if (!(await deleteUser(id))) return NextResponse.json({ error: "User not found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: "Unable to delete account" }, { status: 500 }) }
}

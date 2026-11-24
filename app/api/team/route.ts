import { NextResponse } from "next/server"
import { currentUser, readUsers } from "@/lib/auth"

export async function GET() {
  const u = await currentUser()
  if (!u || !(u.role === "Senior officer" || u.role === "Management")) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  try {
    const users = (await readUsers()).map(({ passwordSalt, passwordHash, ...safe }) => safe)
    return NextResponse.json({ users })
  } catch { return NextResponse.json({ error: "Could not load staff." }, { status: 500 }) }
}

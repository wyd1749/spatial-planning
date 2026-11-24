import { NextResponse } from "next/server"
import { checkPassword, createSessionToken, findUserByEmail, setSession } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 })
    const found = await findUserByEmail(email)
    const user = found && found.status === "Active" ? found : null
    if (!user || !checkPassword(password, user.passwordSalt, user.passwordHash)) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
    const token = createSessionToken({ id: user.id, name: user.name, email: user.email, role: user.role })
    await setSession(token)
    const redirectTo = user.role === "Senior officer" ? "/senior-dashboard" : user.role === "Management" ? "/management-dashboard" : "/planning-dashboard"
    return NextResponse.json({ redirectTo, user: { name: user.name, role: user.role } })
  } catch { return NextResponse.json({ error: "Unable to sign in." }, { status: 500 }) }
}

import { NextResponse } from "next/server"
import { checkPassword, clearFailedLogins, createSessionToken, findUserByEmail, MAX_FAILED_LOGINS, recordFailedLogin, setSession } from "@/lib/auth"
import { logActivity } from "@/lib/store"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 })
    const found = await findUserByEmail(email)
    if (found && found.status === "Locked") {
      // Only reveal "locked" to someone who knows the right password, so this can't be used to probe which emails exist.
      if (checkPassword(password, found.passwordSalt, found.passwordHash)) return NextResponse.json({ error: "This account is locked. Please contact the Senior officer." }, { status: 403 })
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
    }
    const user = found && found.status === "Active" ? found : null
    if (!user || !checkPassword(password, user.passwordSalt, user.passwordHash)) {
      if (user) {
        const { locked } = await recordFailedLogin(user)
        if (locked) {
          await logActivity("System", `locked the account after ${MAX_FAILED_LOGINS} failed sign-in attempts:`, user.email).catch(() => {})
          return NextResponse.json({ error: `Too many failed attempts. This account is now locked. Please contact the Senior officer.` }, { status: 403 })
        }
        const left = MAX_FAILED_LOGINS - (user.failedAttempts + 1)
        if (user.role !== "Senior officer" && left > 0) return NextResponse.json({ error: `Invalid email or password. ${left} attempt${left === 1 ? "" : "s"} left before the account locks.` }, { status: 401 })
      }
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
    }
    await clearFailedLogins(user)
    const token = createSessionToken({ id: user.id, name: user.name, email: user.email, role: user.role })
    await setSession(token)
    const redirectTo = user.role === "Senior officer" ? "/senior-dashboard" : user.role === "Management" ? "/management-dashboard" : "/planning-dashboard"
    return NextResponse.json({ redirectTo, user: { name: user.name, role: user.role } })
  } catch { return NextResponse.json({ error: "Unable to sign in." }, { status: 500 }) }
}

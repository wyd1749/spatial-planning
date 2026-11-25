import "server-only"
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { db } from "./supabase"

export type UserRole = "Senior officer" | "Management" | "Planning officer"
export type UserRecord = { id: string; name: string; email: string; role: UserRole; passwordSalt: string; passwordHash: string; status: "Active" | "Setup pending" | "Locked"; failedAttempts: number }

type UserRow = { id: string; name: string; email: string; role: string; password_salt: string; password_hash: string; status: string; failed_attempts: number | null }
const COLS = "id,name,email,role,password_salt,password_hash,status,failed_attempts"
const toUser = (r: UserRow): UserRecord => ({ id: r.id, name: r.name, email: r.email, role: r.role as UserRole, passwordSalt: r.password_salt, passwordHash: r.password_hash, status: r.status as UserRecord["status"], failedAttempts: r.failed_attempts ?? 0 })
const normEmail = (email: string) => email.trim().toLowerCase()

const COOKIE = "spatial_session"
const SECRET = process.env.SESSION_SECRET || (process.env.NODE_ENV !== "production" ? "dev-only-change-this-secret" : "")
if (!SECRET) throw new Error("Set SESSION_SECRET in your environment before running in production.")

// ---------- Users (Supabase: public.staff_users) ----------
export async function readUsers(): Promise<UserRecord[]> {
  const { data, error } = await db().from("staff_users").select(COLS).order("created_at", { ascending: true })
  if (error) throw error
  return (data as UserRow[]).map(toUser)
}
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const { data, error } = await db().from("staff_users").select(COLS).eq("email", normEmail(email)).maybeSingle()
  if (error) throw error
  return data ? toUser(data as UserRow) : null
}
export class EmailExistsError extends Error { constructor() { super("Email already exists.") } }
export async function createUser(input: { name: string; email: string; role: UserRole; passwordSalt: string; passwordHash: string }): Promise<UserRecord> {
  const row = { id: `usr-${randomUUID()}`, name: input.name.trim(), email: normEmail(input.email), role: input.role, password_salt: input.passwordSalt, password_hash: input.passwordHash, status: "Active" }
  const { data, error } = await db().from("staff_users").insert(row).select(COLS).single()
  if (error) { if (error.code === "23505") throw new EmailExistsError(); throw error }
  return toUser(data as UserRow)
}
export async function updateUser(id: string, patch: { role?: UserRole; status?: UserRecord["status"]; passwordSalt?: string; passwordHash?: string }): Promise<UserRecord | null> {
  const { passwordSalt, passwordHash, ...rest } = patch
  const row: Record<string, unknown> = { ...rest }
  if (passwordSalt && passwordHash) { row.password_salt = passwordSalt; row.password_hash = passwordHash }
  if (patch.status === "Active" || (passwordSalt && passwordHash)) row.failed_attempts = 0 // unlocking or resetting a password gives a fresh start
  const { data, error } = await db().from("staff_users").update(row).eq("id", id).select(COLS).maybeSingle()
  if (error) throw error
  return data ? toUser(data as UserRow) : null
}
export const MAX_FAILED_LOGINS = 3
/** Counts a wrong password. At 3 in a row the account locks itself, except Senior officers, who are never auto-locked. */
export async function recordFailedLogin(user: UserRecord): Promise<{ locked: boolean }> {
  const attempts = (user.failedAttempts ?? 0) + 1
  const lock = user.role !== "Senior officer" && attempts >= MAX_FAILED_LOGINS
  const { error } = await db().from("staff_users").update(lock ? { failed_attempts: attempts, status: "Locked" } : { failed_attempts: attempts }).eq("id", user.id)
  if (error) throw error
  return { locked: lock }
}
export async function clearFailedLogins(user: UserRecord) {
  if ((user.failedAttempts ?? 0) === 0) return
  await db().from("staff_users").update({ failed_attempts: 0 }).eq("id", user.id)
}
export async function deleteUser(id: string): Promise<boolean> {
  const { data, error } = await db().from("staff_users").delete().eq("id", id).select("id")
  if (error) throw error
  return (data?.length ?? 0) > 0
}

// ---------- Passwords & sessions (unchanged) ----------
export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) { return { salt, hash: scryptSync(password, salt, 64).toString("hex") } }
export function checkPassword(password: string, salt: string, hash: string) { const candidate = scryptSync(password, salt, 64); const stored = Buffer.from(hash, "hex"); return stored.length === candidate.length && timingSafeEqual(candidate, stored) }
function sign(value: string) { return createHmac("sha256", SECRET).update(value).digest("hex") }
export function createSessionToken(user: Pick<UserRecord, "id" | "email" | "role" | "name">) { const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url"); return `${payload}.${sign(payload)}` }
export function verifySession(token: string) { try { const [payload, sig] = token.split("."); if (!payload || !sig || !timingSafeEqual(Buffer.from(sig), Buffer.from(sign(payload)))) return null; const data = JSON.parse(Buffer.from(payload, "base64url").toString()); if (data.exp < Date.now()) return null; return data as { id: string; email: string; role: UserRole; name: string; exp: number } } catch { return null } }
// Re-checks the account in the database on EVERY request, so disabling, deleting or demoting a
// user takes effect immediately instead of waiting for their 8-hour cookie to expire.
export async function currentUser() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  const session = token ? verifySession(token) : null
  if (!session) return null
  const { data, error } = await db().from("staff_users").select("id,name,email,role,status").eq("id", session.id).maybeSingle()
  if (error) { console.error("currentUser lookup failed:", error.message); return null } // fail closed
  if (!data || data.status !== "Active") return null
  return { id: data.id as string, email: data.email as string, role: data.role as UserRole, name: data.name as string, exp: session.exp }
}
export async function setSession(token: string) { const jar = await cookies(); jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 }) }
export async function clearSession() { const jar = await cookies(); jar.delete(COOKIE) }
export const sessionCookieName = COOKIE

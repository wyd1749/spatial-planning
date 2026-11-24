// Creates (or resets) the Senior officer account in Supabase.
// Run from the project root, after schema.sql has been run and .env.local is filled in:
//   node --env-file=.env.local scripts/create-senior-officer.mjs "YourStrongPassword"
// Optional: pass email and name as 2nd/3rd arguments.
import { createClient } from "@supabase/supabase-js"
import { randomBytes, randomUUID, scryptSync } from "node:crypto"

const [password, email = "seniorofficer@gmail.com", name = "Senior Officer"] = process.argv.slice(2)
if (!password || password.length < 8) { console.error('Usage: node --env-file=.env.local scripts/create-senior-officer.mjs "Password(8+ chars)" [email] [name]'); process.exit(1) }
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env.local"); process.exit(1) }

const sb = createClient(url, key, { auth: { persistSession: false } })
const salt = randomBytes(16).toString("hex")                       // same format the app uses
const hash = scryptSync(password, salt, 64).toString("hex")
const e = email.trim().toLowerCase()

const { data: existing, error: findErr } = await sb.from("staff_users").select("id").eq("email", e).maybeSingle()
if (findErr) { console.error("Database error:", findErr.message); process.exit(1) }

const result = existing
  ? await sb.from("staff_users").update({ name, role: "Senior officer", status: "Active", password_salt: salt, password_hash: hash }).eq("id", existing.id)
  : await sb.from("staff_users").insert({ id: `usr-${randomUUID()}`, name, email: e, role: "Senior officer", status: "Active", password_salt: salt, password_hash: hash })
if (result.error) { console.error("Failed:", result.error.message); process.exit(1) }
console.log(`${existing ? "Updated" : "Created"} Senior officer account: ${e}`)

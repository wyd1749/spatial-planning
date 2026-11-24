import "server-only"
import { randomUUID } from "node:crypto"
import { db } from "./supabase"

export type AppRecord = {
  id: string; reference: string; applicant: string; email?: string; phone?: string; type: string; stand: string;
  stage: string; officer: string; received: string; due: string; status: string; description?: string;
  notes: { id: string; text: string; author: string; createdAt: string }[];
  consultationResponses: { id: string; stakeholder: string; response: string; createdAt: string }[];
  decision?: string; documents: { id: string; name: string; description: string; addedAt: string }[];
}
export type Activity = { id: string; user: string; action: string; application?: string; createdAt: string }

const SELECT = "*, case_notes(*), application_documents(*), consultation_responses(*)"
const newId = (prefix: string) => `${prefix}-${randomUUID()}`

// ---------- Dates: stored as real DATE columns, shown to the UI as "12 Nov 2026" (unchanged format) ----------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
export class InvalidDateError extends Error { constructor() { super("Invalid date.") } }
const fmtDate = (iso?: string | null) => { if (!iso) return ""; const [y, m, d] = iso.slice(0, 10).split("-"); return `${d} ${MONTHS[Number(m) - 1]} ${y}` }
// Accepts "2026-12-12" (date input) or "12 Dec 2026". Empty -> null. Anything else -> InvalidDateError.
export function parseDateInput(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") throw new InvalidDateError()
  const t = value.trim(); if (!t) return null
  let y: number, m: number, d: number
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3] }
  else {
    const txt = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})$/.exec(t)
    if (!txt) throw new InvalidDateError()
    d = +txt[1]; y = +txt[3]; m = MONTHS.findIndex(n => txt[2].toLowerCase().startsWith(n.toLowerCase())) + 1
    if (!m) throw new InvalidDateError()
  }
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw new InvalidDateError()
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

function toApp(r: any): AppRecord {
  const byDate = (key: string) => (a: any, b: any) => new Date(a[key]).getTime() - new Date(b[key]).getTime()
  return {
    id: r.id, reference: r.reference, applicant: r.applicant, email: r.email ?? "", phone: r.phone ?? "", type: r.type, stand: r.stand,
    stage: r.stage, officer: r.officer, received: fmtDate(r.received), due: fmtDate(r.due), status: r.status, description: r.description ?? "",
    decision: r.decision ?? undefined,
    notes: (r.case_notes ?? []).sort(byDate("created_at")).map((n: any) => ({ id: n.id, text: n.text, author: n.author, createdAt: n.created_at })),
    consultationResponses: (r.consultation_responses ?? []).sort(byDate("created_at")).map((c: any) => ({ id: c.id, stakeholder: c.stakeholder, response: c.response, createdAt: c.created_at })),
    documents: (r.application_documents ?? []).sort(byDate("added_at")).map((d: any) => ({ id: d.id, name: d.name, description: d.description ?? "", addedAt: d.added_at })),
  }
}

// Planning officers may only open applications assigned to them (same rule as before).
export function canAccess(user: { role: string; name: string }, app: { officer: string }) {
  if (user.role !== "Planning officer") return true
  const officer = app.officer.toLowerCase()
  const name = user.name.trim()
  const parts = name.split(/\s+/)
  return officer === name.toLowerCase() || officer === `${parts[0][0]}. ${parts[parts.length - 1]}`.toLowerCase()
}

// Filtering now happens in the database. Planning officers only ever receive rows that pass canAccess().
const clean = (v: string) => v.replace(/[%_\\",()*]/g, " ").trim()
export async function listApplications(opts: { forUser?: { role: string; name: string }; status?: string; q?: string; limit?: number } = {}): Promise<AppRecord[]> {
  let query = db().from("applications").select(SELECT).order("created_at", { ascending: false }).limit(Math.min(opts.limit ?? 1000, 1000))
  if (opts.status) query = query.eq("status", opts.status)
  const search = clean(opts.q ?? "")
  if (search) query = query.or(["reference", "applicant", "type", "stand", "officer"].map(c => `${c}.ilike."%${search}%"`).join(","))
  const planner = opts.forUser?.role === "Planning officer"
  if (planner) { // narrow in SQL by surname, then enforce the exact rule below
    const last = clean(opts.forUser!.name.trim().split(/\s+/).at(-1) ?? "")
    if (last) query = query.ilike("officer", `%${last}%`)
  }
  const { data, error } = await query
  if (error) throw error
  const apps = (data ?? []).map(toApp)
  return planner ? apps.filter(a => canAccess(opts.forUser!, a)) : apps
}

// Accepts either the internal id or the reference (e.g. SP/26/SUB/014).
export async function getApplication(idOrRef: string): Promise<AppRecord | null> {
  const byId = await db().from("applications").select(SELECT).eq("id", idOrRef).maybeSingle()
  if (byId.error) throw byId.error
  if (byId.data) return toApp(byId.data)
  const byRef = await db().from("applications").select(SELECT).eq("reference", idOrRef).maybeSingle()
  if (byRef.error) throw byRef.error
  return byRef.data ? toApp(byRef.data) : null
}

export async function createApplication(input: { applicant: string; type: string; stand: string; email?: string; phone?: string; officer: string; due?: string; description?: string }): Promise<AppRecord> {
  const prefix = `SP/${new Date().getFullYear().toString().slice(-2)}/${input.type.slice(0, 3).toUpperCase()}/`
  const received = new Date().toISOString().slice(0, 10)
  const due = parseDateInput(input.due) // throws InvalidDateError before anything is saved
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db().from("applications").select("reference").like("reference", `${prefix}%`)
    if (existing.error) throw existing.error
    const nums = (existing.data ?? []).map(x => Number(String(x.reference).split("/").pop())).filter(Number.isFinite)
    const reference = prefix + String(Math.max(0, ...nums) + 1).padStart(3, "0")
    const row = { id: newId("app"), reference, applicant: input.applicant.trim(), email: input.email || "", phone: input.phone || "", type: input.type, stand: input.stand.trim(), stage: "Application received", officer: input.officer, received, due, status: "In progress", description: input.description || "" }
    const { error } = await db().from("applications").insert(row)
    if (!error) return toApp({ ...row, decision: null })
    if (error.code !== "23505") throw error // 23505 = duplicate reference (two people saved at once) -> retry
  }
  throw new Error("Could not generate a unique application reference.")
}

const PATCHABLE = ["stage", "status", "officer", "decision", "due", "description"] as const
export async function updateApplication(idOrRef: string, body: Record<string, unknown>): Promise<AppRecord | null> {
  const app = await getApplication(idOrRef)
  if (!app) return null
  const patch: Record<string, string | null> = {}
  for (const key of PATCHABLE) {
    if (typeof body[key] !== "string") continue
    patch[key] = key === "due" ? parseDateInput(body[key]) : (body[key] as string)
  }
  if (Object.keys(patch).length) {
    const { error } = await db().from("applications").update(patch).eq("id", app.id)
    if (error) throw error
  }
  return getApplication(app.id)
}

export async function deleteApplication(idOrRef: string): Promise<AppRecord | null> {
  const app = await getApplication(idOrRef)
  if (!app) return null
  const { error } = await db().from("applications").delete().eq("id", app.id) // notes/documents/consultations cascade
  if (error) throw error
  return app
}

export async function addNote(applicationId: string, text: string, author: string) {
  const { error } = await db().from("case_notes").insert({ id: newId("note"), application_id: applicationId, text: text.trim(), author })
  if (error) throw error
}
export async function addDocument(applicationId: string, name: string, description: string) {
  const { error } = await db().from("application_documents").insert({ id: newId("doc"), application_id: applicationId, name: name.trim(), description: description.trim() })
  if (error) throw error
}
// The stage change to "Consultation" is done by a database trigger (migration-002-fixes.sql),
// so the insert and the stage update succeed or fail together.
export async function addConsultation(applicationId: string, stakeholder: string, response: string) {
  const item = { id: newId("consult"), application_id: applicationId, stakeholder, response }
  const ins = await db().from("consultation_responses").insert(item).select("id,stakeholder,response,created_at").single()
  if (ins.error) throw ins.error
  return { id: ins.data.id, stakeholder: ins.data.stakeholder, response: ins.data.response, createdAt: ins.data.created_at }
}
export async function listConsultations(forUser?: { role: string; name: string }) {
  const { data, error } = await db().from("consultation_responses").select("id,stakeholder,response,created_at,applications(reference,applicant,officer)").order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? [])
    .filter((c: any) => !forUser || canAccess(forUser, { officer: c.applications?.officer ?? "" }))
    .map((c: any) => ({ id: c.id, stakeholder: c.stakeholder, response: c.response, createdAt: c.created_at, reference: c.applications?.reference, applicant: c.applications?.applicant }))
}

export async function listActivities(limit = 500): Promise<Activity[]> {
  const { data, error } = await db().from("activities").select("id,user_name,action,application,created_at").order("created_at", { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []).map((a: any) => ({ id: a.id, user: a.user_name, action: a.action, application: a.application ?? undefined, createdAt: a.created_at }))
}
export async function logActivity(actor: string, action: string, application?: string) {
  const { error } = await db().from("activities").insert({ id: newId("act"), user_name: actor, action, application: application ?? null })
  if (error) console.error("logActivity failed:", error.message) // never block the main action because the audit insert failed
}

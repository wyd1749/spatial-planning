import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { currentUser } from "@/lib/auth"
import { db } from "@/lib/supabase"
import { addNote, canAccess, getApplication, logActivity } from "@/lib/store"
import { CIRCULATION_STATUSES, FINAL_STATUSES, MGMT_STAGES, WORKFLOW, defaultCirculation, normStage } from "@/lib/workflow"

export const dynamic = "force-dynamic"

const ORDER = WORKFLOW.map(s => s.label)
const today = () => new Date().toISOString().slice(0, 10)
const plusMonth = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10) }
const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status })
type User = { id: string; role: string; name: string }

async function load(idOrRef: string) {
  const app = await getApplication(idOrRef)
  if (!app) return null
  const ex = await db().from("applications").select("due,acknowledge_by,acknowledged_at,director_report_at,advertised_from,advertised_until,permit_prepared_at,permit_issued_at").eq("id", app.id).single()
  if (ex.error) throw ex.error
  const circ = await db().from("application_circulation").select("*").eq("application_id", app.id).order("created_at", { ascending: true })
  if (circ.error) throw circ.error
  const hist = await db().from("application_stage_history").select("*").eq("application_id", app.id).order("created_at", { ascending: false }).limit(50)
  if (hist.error) throw hist.error
  return { app, ex: ex.data as any, circ: (circ.data ?? []) as any[], hist: (hist.data ?? []) as any[] }
}
type Ctx = NonNullable<Awaited<ReturnType<typeof load>>>

// Who may do what, and what is blocking the next move.
function evaluate(user: User, c: Ctx) {
  const stage = normStage(c.app.stage)
  const idx = ORDER.indexOf(stage)
  const closed = FINAL_STATUSES.includes(c.app.status)
  const mgmt = user.role === "Management"
  const staff = mgmt || (user.role === "Planning officer" && canAccess(user, c.app))
  const mgmtStage = MGMT_STAGES.includes(stage)
  const actor = mgmtStage ? mgmt : staff
  const pending = c.circ.filter(x => x.status === "Pending").length
  const next = idx >= 0 && idx < ORDER.length - 1 ? ORDER[idx + 1] : null

  let blocker = ""
  if (closed) blocker = c.app.status === "Cancelled" ? "This application is cancelled. Reopen it first." : "This application is closed."
  else if (!actor) blocker = mgmtStage ? "Only Management can move this stage." : "You can’t move this application."
  else if (stage === "Council resolution") blocker = "Record the Council’s decision below."
  else if (stage === "Permit issuance") blocker = "Prepare and approve the permit below."
  else if (!next) blocker = "This is the final stage."
  else if (stage === "Acknowledgement" && !c.ex.acknowledged_at) blocker = "Send the acknowledgement to the applicant first."
  else if (stage === "Acknowledgement" && !c.ex.director_report_at) blocker = "Submit the report to the Director first."
  else if (stage === "Circulation" && c.circ.length === 0) blocker = "Add at least one body to circulate to."
  else if (stage === "Circulation" && pending > 0) blocker = `${pending} circulation ${pending === 1 ? "reply is" : "replies are"} still pending.`
  else if (stage === "Advertising" && c.ex.advertised_until && c.ex.advertised_until > today()) blocker = `Advertising runs until ${c.ex.advertised_until}.`

  const open = !closed
  return {
    stage, next, blocker,
    canAdvance: !blocker,
    can: {
      advance: !blocker,
      return: open && mgmt && mgmtStage,
      council: open && mgmt && stage === "Council resolution",
      preparePermit: open && staff && stage === "Permit issuance" && !c.ex.permit_prepared_at,
      approvePermit: open && mgmt && stage === "Permit issuance" && !!c.ex.permit_prepared_at,
      acknowledge: open && staff && stage === "Acknowledgement" && !c.ex.acknowledged_at,
      directorReport: open && staff && stage === "Acknowledgement" && !c.ex.director_report_at,
      circulation: open && staff && stage === "Circulation",
    },
  }
}

function view(user: User, c: Ctx) {
  const e = evaluate(user, c)
  return {
    stage: e.stage, status: c.app.status, next: e.next, blocker: e.blocker, can: e.can,
    deadlines: { due: c.ex.due, acknowledgeBy: c.ex.acknowledge_by, advertisedFrom: c.ex.advertised_from, advertisedUntil: c.ex.advertised_until },
    flags: { acknowledgedAt: c.ex.acknowledged_at, directorReportAt: c.ex.director_report_at, permitPreparedAt: c.ex.permit_prepared_at, permitIssuedAt: c.ex.permit_issued_at },
    circulation: c.circ.map(x => ({ id: x.id, body: x.body, kind: x.kind, status: x.status, note: x.note, updatedBy: x.updated_by, updatedAt: x.updated_at })),
    history: c.hist.map(h => ({ id: h.id, from: h.from_stage, to: h.to_stage, by: h.moved_by, note: h.note, at: h.created_at })),
  }
}

async function moveTo(user: User, c: Ctx, to: string, patch: Record<string, unknown>, action: string, note?: string) {
  const { error } = await db().from("applications").update({ stage: to, ...patch }).eq("id", c.app.id)
  if (error) throw error
  const h = await db().from("application_stage_history").insert({ id: `hist-${randomUUID()}`, application_id: c.app.id, from_stage: normStage(c.app.stage), to_stage: to, moved_by: user.name, note: note ?? null })
  if (h.error) console.error("stage history failed:", h.error.message)
  await logActivity(user.name, action, c.app.reference)
}
async function patchApp(c: Ctx, patch: Record<string, unknown>) {
  const { error } = await db().from("applications").update(patch).eq("id", c.app.id)
  if (error) throw error
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser()
  if (!user) return fail("Unauthorized", 401)
  const c = await load((await ctx.params).id)
  if (!c) return fail("Application not found", 404)
  if (user.role === "Planning officer" && !canAccess(user, c.app)) return fail("Forbidden", 403)
  return NextResponse.json(view(user, c))
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser()
  if (!user) return fail("Unauthorized", 401)
  if (user.role === "Senior officer") return fail("Senior officers manage accounts and can’t move applications.", 403)
  const id = (await ctx.params).id
  const first = await load(id)
  if (!first) return fail("Application not found", 404)
  let c: Ctx = first
  if (user.role === "Planning officer" && !canAccess(user, c.app)) return fail("Forbidden", 403)

  const body = await req.json().catch(() => ({})) as Record<string, any>
  const e = evaluate(user, c)
  const ref = c.app.reference

  try {
    switch (body.action) {
      case "advance": {
        if (!e.canAdvance || !e.next) return fail(e.blocker || "Can’t move this application.", 409)
        const to = e.next
        const patch: Record<string, unknown> = { status: to === "Management review" ? "Review" : "In progress" }
        if (to === "Advertising") { const t = today(); patch.advertised_from = t; patch.advertised_until = plusMonth(t) }
        if (to === "Circulation" && c.circ.length === 0) {
          const rows = defaultCirculation(c.app.type).map(x => ({ id: `circ-${randomUUID()}`, application_id: c.app.id, body: x.body, kind: x.kind }))
          if (rows.length) { const r = await db().from("application_circulation").insert(rows); if (r.error) throw r.error }
        }
        await moveTo(user, c, to, patch, `moved application to ${to}`)
        break
      }
      case "acknowledge":
        if (!e.can.acknowledge) return fail("Not available right now.", 409)
        await patchApp(c, { acknowledged_at: new Date().toISOString() }); await logActivity(user.name, "sent the acknowledgement for", ref); break
      case "director_report":
        if (!e.can.directorReport) return fail("Not available right now.", 409)
        await patchApp(c, { director_report_at: new Date().toISOString() }); await logActivity(user.name, "submitted the Director report for", ref); break
      case "circulation_update": {
        if (!e.can.circulation) return fail("Circulation can only be edited during the Circulation stage.", 409)
        if (!CIRCULATION_STATUSES.includes(body.status)) return fail("Invalid status.")
        const r = await db().from("application_circulation").update({ status: body.status, note: String(body.note ?? ""), updated_by: user.name, updated_at: new Date().toISOString() }).eq("id", body.id).eq("application_id", c.app.id)
        if (r.error) throw r.error
        await logActivity(user.name, `recorded a circulation reply on`, ref); break
      }
      case "circulation_add": {
        if (!e.can.circulation) return fail("Circulation can only be edited during the Circulation stage.", 409)
        const name = String(body.body ?? "").trim()
        if (!name) return fail("Enter the name of the body.")
        const r = await db().from("application_circulation").insert({ id: `circ-${randomUUID()}`, application_id: c.app.id, body: name, kind: body.kind === "External" ? "External" : "Internal" })
        if (r.error) throw r.error
        break
      }
      case "circulation_remove": {
        if (!e.can.circulation) return fail("Circulation can only be edited during the Circulation stage.", 409)
        const r = await db().from("application_circulation").delete().eq("id", body.id).eq("application_id", c.app.id)
        if (r.error) throw r.error
        break
      }
      case "council_decision": {
        if (!e.can.council) return fail("Only Management can record the Council’s decision, at the Council resolution stage.", 403)
        if (body.decision === "approved") await moveTo(user, c, "Permit issuance", { status: "Review", decision: "Approved by Council" }, "recorded Council approval for")
        else if (body.decision === "rejected") { await patchApp(c, { status: "Rejected", decision: "Rejected by Council" }); await logActivity(user.name, "recorded Council rejection for", ref) }
        else return fail("Choose approved or rejected.")
        break
      }
      case "prepare_permit":
        if (!e.can.preparePermit) return fail("Not available right now.", 409)
        await patchApp(c, { permit_prepared_at: new Date().toISOString() }); await logActivity(user.name, "prepared the permit for", ref); break
      case "approve_permit":
        if (!e.can.approvePermit) return fail("The permit must be prepared first, and only Management can approve it.", 403)
        await patchApp(c, { status: "Approved", decision: "Permit issued", permit_issued_at: new Date().toISOString() }); await logActivity(user.name, "approved and issued the permit for", ref); break
      case "return": {
        if (!e.can.return) return fail("Only Management can return an application.", 403)
        const reason = String(body.reason ?? "").trim()
        if (!reason) return fail("Give a reason for returning the application.")
        await moveTo(user, c, "Requirements check", { status: "In progress", decision: "Returned for amendment", acknowledged_at: null, director_report_at: null, advertised_from: null, advertised_until: null, permit_prepared_at: null }, "returned for amendment", reason)
        await addNote(c.app.id, `Returned for amendment: ${reason}`, user.name)
        break
      }
      default: return fail("Unknown action.")
    }
  } catch (err: any) {
    console.error("workflow action failed:", err?.message || err)
    return fail(`Could not save: ${err?.message || "unknown error"}${err?.code ? ` (code ${err.code})` : ""}. If this mentions a missing table or column, run migration-005 again.`, 500)
  }
  c = (await load(c.app.id)) ?? c
  return NextResponse.json(view(user, c))
}

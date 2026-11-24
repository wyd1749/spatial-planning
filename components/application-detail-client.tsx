"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Ban, Check, CircleAlert, ClipboardList, GitBranch, MessageSquareText, NotebookPen, Plus, RotateCcw, Save, Trash2, Users } from "lucide-react"
import { useLiveTick } from "@/lib/live"
import { CIRCULATION_STATUSES, MGMT_STAGES, WORKFLOW, normStage } from "@/lib/workflow"
import { CardHead, PortalShell, StatusPill, effectiveStatus, type Role } from "@/components/portal"

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—")
const fmtTime = (v?: string | null) => (v ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "")

export default function Detail({ id, role, name }: { id: string; role: string; name: string }) {
  const [app, setApp] = useState<any>(null)
  const [wf, setWf] = useState<any>(null)
  const [missing, setMissing] = useState(false)
  const [note, setNote] = useState("")
  const [notice, setNotice] = useState("")
  const [officer, setOfficer] = useState("")
  const [reason, setReason] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const [newBody, setNewBody] = useState("")
  const [newKind, setNewKind] = useState("Internal")
  const [busy, setBusy] = useState(false)
  const editingOfficer = useRef(false)
  const tick = useLiveTick()

  const load = () => {
    fetch(`/api/applications/${id}`).then(r => r.json()).then(d => { if (d.application) { setApp(d.application); if (!editingOfficer.current) setOfficer(d.application.officer) } else setMissing(true) }).catch(() => setMissing(true))
    fetch(`/api/applications/${id}/workflow`).then(r => r.ok ? r.json() : null).then(d => { if (d) setWf(d) }).catch(() => {})
  }
  useEffect(() => { load() }, [id, tick])

  async function patch(data: any) {
    const r = await fetch(`/api/applications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
    const d = await r.json()
    setNotice(r.ok ? "Update saved." : d.error)
    if (r.ok) { setApp(d.application); setOfficer(d.application.officer); editingOfficer.current = false }
  }
  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      const r = await fetch(`/api/applications/${id}/workflow`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) })
      const d = await r.json()
      if (!r.ok) { setNotice(d.error || "That didn’t work."); return }
      setWf(d); setNotice(""); if (action === "return") setReason(""); if (action === "circulation_add") setNewBody("")
      load()
    } finally { setBusy(false) }
  }
  async function cancelAction(action: "cancel" | "reopen") {
    setBusy(true)
    try {
      const r = await fetch(`/api/applications/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason: cancelReason }) })
      const d = await r.json()
      if (!r.ok) { setNotice(d.error || "That didn’t work."); return }
      setApp(d.application); setCancelReason(""); setNotice(action === "cancel" ? "Application cancelled." : "Application reopened."); load()
    } finally { setBusy(false) }
  }
  async function addNote() {
    if (!note.trim()) return
    const r = await fetch(`/api/applications/${id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: note }) })
    const d = await r.json()
    setNotice(r.ok ? "Note saved." : d.error)
    if (r.ok) { setNote(""); load() }
  }

  const back = <Link href="/applications" className="pt-btn"><ArrowLeft size={18} />All applications</Link>
  if (!app) return (
    <PortalShell role={role as Role} name={name} eyebrow="APPLICATION RECORD" title={missing ? "Application not found" : "Loading record…"} subtitle={missing ? "It may have been archived, or it isn’t assigned to you." : undefined} actions={back}><div /></PortalShell>
  )

  const shown = effectiveStatus(app)
  const isManager = role === "Management"
  const cancelled = app.status === "Cancelled"
  const canCancel = isManager && !["Approved", "Rejected", "Cancelled"].includes(app.status)
  const stage = wf?.stage || normStage(app.stage)
  const stageIdx = WORKFLOW.findIndex(s => s.label === stage)
  const owner = WORKFLOW[stageIdx]?.owner
  const can = cancelled ? {} : (wf?.can || {})
  const ackLate = !cancelled && wf && !wf.flags.acknowledgedAt && wf.deadlines.acknowledgeBy && stage !== "Application received" && new Date(wf.deadlines.acknowledgeBy).getTime() + 86400000 < Date.now()

  return (
    <PortalShell role={role as Role} name={name} notice={notice} onDismiss={() => setNotice("")}
      eyebrow="APPLICATION RECORD" title={app.reference} subtitle={`${app.applicant} · ${app.type} · ${app.stand}`} actions={back}>
      <div className="pt-stack">
        <section className="pt-card">
          <CardHead icon={ClipboardList} title="Overview" sub="Where this application stands right now" />
          <div className="pt-kv">
            <div><small>Stage</small><strong>{stage}</strong></div>
            <div><small>Status</small><StatusPill status={cancelled ? "Cancelled" : shown.status} /></div>
            <div><small>Officer</small><strong>{app.officer}</strong></div>
            <div><small>Received</small><strong>{app.received}</strong></div>
            <div><small>Due</small><strong>{app.due || "Not set"}</strong></div>
          </div>
        </section>

        <section className="pt-card">
          <CardHead icon={GitBranch} title="Workflow" sub={owner ? `Current stage: ${stage} · handled by ${owner}` : "Application stages from receipt to permit"} />
          <div className="pt-steps" aria-label="Workflow progress">
            {WORKFLOW.map((s, i) => (
              <div key={s.label} className={`pt-step ${i < stageIdx || app.status === "Approved" ? "done" : i === stageIdx ? "now" : ""}`} aria-current={i === stageIdx ? "step" : undefined}>
                <b>{i < stageIdx || app.status === "Approved" ? <Check size={16} /> : i + 1}</b>{s.label}<small>{s.owner === "Management" ? "Management" : "Officer"}</small>
              </div>
            ))}
          </div>

          {wf && <div className="pt-kv" style={{ marginBottom: 14 }}>
            <div><small>Due date</small><strong>{fmt(wf.deadlines.due)}</strong></div>
            <div><small>Acknowledge by</small><strong style={ackLate ? { color: "#d11f26" } : undefined}>{fmt(wf.deadlines.acknowledgeBy)}{ackLate ? " (late)" : ""}</strong></div>
            <div><small>Advertising</small><strong>{wf.deadlines.advertisedFrom ? `${fmt(wf.deadlines.advertisedFrom)} – ${fmt(wf.deadlines.advertisedUntil)}` : "Not started"}</strong></div>
          </div>}

          {wf?.blocker && app.status !== "Approved" && !cancelled && <div className="pt-blocker"><CircleAlert size={18} /><span>{wf.blocker}</span></div>}
          {app.status === "Rejected" && <div className="pt-blocker" style={{ background: "#fde3e4", color: "#b02a1e" }}><CircleAlert size={18} /><span>{app.decision || "Rejected"}. This application is closed.</span></div>}
          {cancelled && <div className="pt-blocker" style={{ background: "#eef1f6", color: "#44598a" }}><Ban size={18} /><span>{app.decision || "Cancelled"}. This application is closed{isManager ? "; you can reopen it below." : "; Management can reopen it."}</span></div>}
          {app.status === "Approved" && <div className="pt-note info"><Check size={17} /><span>Permit approved and issued{wf?.flags.permitIssuedAt ? ` on ${fmt(wf.flags.permitIssuedAt)}` : ""}.</span></div>}

          {wf && !cancelled && stage === "Acknowledgement" && (
            <div className="pt-todo">
              {wf.flags.acknowledgedAt ? <span className="pt-tick"><Check size={16} />Acknowledgement sent {fmt(wf.flags.acknowledgedAt)}</span> : <button className="pt-btn sm" disabled={!can.acknowledge || busy} onClick={() => act("acknowledge")}>Mark acknowledgement sent</button>}
              {wf.flags.directorReportAt ? <span className="pt-tick"><Check size={16} />Director report submitted {fmt(wf.flags.directorReportAt)}</span> : <button className="pt-btn sm" disabled={!can.directorReport || busy} onClick={() => act("director_report")}>Mark Director report submitted</button>}
            </div>
          )}

          {wf && !cancelled && stage === "Permit issuance" && app.status !== "Approved" && app.status !== "Rejected" && (
            <div className="pt-todo">
              {wf.flags.permitPreparedAt ? <span className="pt-tick"><Check size={16} />Permit prepared {fmt(wf.flags.permitPreparedAt)}</span> : <button className="pt-btn sm" disabled={!can.preparePermit || busy} onClick={() => act("prepare_permit")}>Mark permit prepared</button>}
              {isManager && <button className="pt-btn grn sm" disabled={!can.approvePermit || busy} onClick={() => act("approve_permit")}>Approve and issue permit</button>}
            </div>
          )}

          {wf && stage === "Council resolution" && can.council && (
            <div className="pt-todo">
              <button className="pt-btn grn sm" disabled={busy} onClick={() => act("council_decision", { decision: "approved" })}>Council approved</button>
              <button className="pt-btn sm" style={{ color: "#c01f26" }} disabled={busy} onClick={() => confirm("Record that Council rejected this application? It will be closed.") && act("council_decision", { decision: "rejected" })}>Council rejected</button>
            </div>
          )}

          {wf?.next && !cancelled && stage !== "Council resolution" && stage !== "Permit issuance" && (
            <div className="pt-todo"><button className="pt-btn pri" disabled={!can.advance || busy} onClick={() => act("advance")}>Move to {wf.next}</button></div>
          )}

          {can.return && (
            <div className="pt-form" style={{ marginTop: 14 }}>
              <label className="pt-field">Return for amendment (Management only)
                <textarea className="pt-in" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for sending this back to the planning officer" />
              </label>
              <div><button className="pt-btn sm" disabled={busy || !reason.trim()} onClick={() => act("return", { reason })}>Return to Requirements check</button></div>
            </div>
          )}
        </section>

        {(canCancel || (cancelled && isManager)) && (
          <section className="pt-card">
            <CardHead icon={cancelled ? RotateCcw : Ban} title={cancelled ? "Reopen application" : "Cancel application"} sub={cancelled ? "Puts this application back In progress at its current stage" : "Stops this application but keeps the full record. A reason is required."} />
            <div className="pt-form">
              <label className="pt-field">{cancelled ? "Reason for reopening (optional)" : "Reason for cancelling"}
                <textarea className="pt-in" rows={2} value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder={cancelled ? "Why is this being reopened?" : "e.g. Withdrawn by the applicant"} />
              </label>
              <div>
                {cancelled
                  ? <button className="pt-btn sm" disabled={busy} onClick={() => confirm("Reopen this application?") && cancelAction("reopen")}><RotateCcw size={16} />Reopen application</button>
                  : <button className="pt-btn sm" style={{ color: "#c01f26" }} disabled={busy || !cancelReason.trim()} onClick={() => confirm("Cancel this application? It will be closed, and you can reopen it later if needed.") && cancelAction("cancel")}><Ban size={16} />Cancel application</button>}
              </div>
            </div>
          </section>
        )}

        {wf && (stage === "Circulation" || wf.circulation.length > 0) && (
          <section className="pt-card">
            <CardHead icon={Users} title="Circulation" count={`${wf.circulation.filter((x: any) => x.status !== "Pending").length}/${wf.circulation.length} replied`} sub="Internal and external bodies this application is circulated to" />
            <div className="pt-tw">
              <table className="pt-table pt-circ" style={{ minWidth: 640 }}>
                <thead><tr><th>Body</th><th>Type</th><th>Reply</th><th>Note</th>{can.circulation && <th />}</tr></thead>
                <tbody>
                  {wf.circulation.map((x: any) => (
                    <tr key={x.id}>
                      <td><strong>{x.body}</strong></td><td>{x.kind}</td>
                      <td>{can.circulation
                        ? <select className="pt-in" value={x.status} disabled={busy} onChange={e => act("circulation_update", { id: x.id, status: e.target.value, note: x.note })}>{CIRCULATION_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
                        : <span className={`pt-pill ${x.status === "Pending" ? "amber" : x.status === "Objection" ? "red" : "green"}`}>{x.status}</span>}</td>
                      <td>{can.circulation
                        ? <input className="pt-in" defaultValue={x.note} placeholder="Add a note" onBlur={e => e.target.value !== x.note && act("circulation_update", { id: x.id, status: x.status, note: e.target.value })} />
                        : x.note}</td>
                      {can.circulation && <td><div className="pt-ra"><button aria-label={`Remove ${x.body}`} onClick={() => act("circulation_remove", { id: x.id })}><Trash2 size={16} /></button></div></td>}
                    </tr>
                  ))}
                  {wf.circulation.length === 0 && <tr><td colSpan={5} className="pt-empty">Nobody added yet.</td></tr>}
                </tbody>
              </table>
            </div>
            {can.circulation && (
              <div className="pt-tools" style={{ marginTop: 14 }}>
                <input className="pt-in" style={{ flex: 1, minWidth: 200 }} value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Add a body, e.g. ZESA" aria-label="Body to add" />
                <select className="pt-in" style={{ width: 140 }} value={newKind} onChange={e => setNewKind(e.target.value)}><option>Internal</option><option>External</option></select>
                <button className="pt-btn sm" disabled={busy || !newBody.trim()} onClick={() => act("circulation_add", { body: newBody, kind: newKind })}><Plus size={16} />Add</button>
              </div>
            )}
          </section>
        )}

        <section className="pt-card">
          <CardHead icon={NotebookPen} title="Record details" sub={isManager ? "Update the assigned officer" : "Only Management can change the assigned officer"} />
          <p style={{ marginBottom: isManager ? 18 : 0, color: "#44598a" }}>{app.description || "No additional description."}</p>
          {isManager && (
            <div className="pt-form">
              <label className="pt-field">Officer
                <span className="pt-row" style={{ flexWrap: "nowrap" }}>
                  <input className="pt-in" value={officer} onChange={e => { editingOfficer.current = true; setOfficer(e.target.value) }} />
                  <button className="pt-btn pri" onClick={() => patch({ officer })}><Save size={17} />Save</button>
                </span>
              </label>
            </div>
          )}
        </section>

        {wf && wf.history.length > 0 && (
          <section className="pt-card">
            <CardHead icon={GitBranch} title="Stage history" count={`${wf.history.length}`} />
            <ul className="pt-tl">{wf.history.map((h: any) => <li key={h.id}><strong>{h.from ? `${h.from} → ${h.to}` : h.to}</strong><small>{h.by} · {fmtTime(h.at)}{h.note ? ` · ${h.note}` : ""}</small></li>)}</ul>
          </section>
        )}

        <section className="pt-card">
          <CardHead icon={NotebookPen} title="Case notes" count={`${(app.notes || []).length}`} sub="Actions and updates recorded against this application" />
          <div className="pt-list">
            {(app.notes || []).map((n: any) => <div key={n.id}><p style={{ marginTop: 0, color: "#0f2a5c" }}>{n.text}</p><small>{n.author} · {new Date(n.createdAt).toLocaleString()}</small></div>)}
            {(app.notes || []).length === 0 && <div><small>No notes yet.</small></div>}
          </div>
          <div className="pt-form" style={{ marginTop: 14 }}>
            <textarea className="pt-in" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Add a case note or action update" aria-label="Case note" />
            <div><button className="pt-btn pri" onClick={addNote}><Save size={17} />Save note</button></div>
          </div>
        </section>

        <section className="pt-card">
          <CardHead icon={MessageSquareText} title="Consultation responses" count={`${(app.consultationResponses || []).length}`} sub="Feedback from stakeholders" right={<Link href="/workspace/consultations" className="pt-link"><Users size={16} />Manage consultations</Link>} />
          <div className="pt-list">
            {(app.consultationResponses || []).map((c: any) => <div key={c.id}><strong>{c.stakeholder}</strong><p>{c.response}</p></div>)}
            {(app.consultationResponses || []).length === 0 && <div><small>No consultation responses recorded.</small></div>}
          </div>
        </section>
      </div>
    </PortalShell>
  )
}

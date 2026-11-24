"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { Activity, ChartColumn, Download, FileSpreadsheet, Search, CircleCheck, CircleX, Clock3, FileCheck2, Files, FileText, Hourglass, MessageSquareText, Save, Users } from "lucide-react"
import { useLiveTick } from "@/lib/live"
import { FINAL_STATUSES, MGMT_STAGES, normStage } from "@/lib/workflow"
import ReportPreview, { tally, withColors, type RPCell } from "@/components/report-preview"
import { CardHead, PortalShell, StatusPill, initials, useApps, type Role, type StatItem } from "@/components/portal"

const META: Record<string, [string, string]> = {
  "management-review": ["Management review", "Applications waiting for a management decision"],
  consultations: ["Consultations", "Record and review stakeholder responses"],
  reports: ["Reports & Analytics", "Live statistics from the application register"],
  team: ["Team & Workload", "Your department’s staff directory"],
  documents: ["Documents", "Document register for every application"],
  activity: ["Activity log", "Audit trail of actions across the system"],
  "user-management": ["User management", "Staff accounts and roles"],
}

export default function Workspace({ module, role, name }: { module: string; role: string; name: string }) {
  const { apps, reload } = useApps()
  const tick = useLiveTick()
  const [activities, setActivities] = useState<any[]>([])
  const [consultations, setConsultations] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [notice, setNotice] = useState("")
  const [applicationId, setApplicationId] = useState("")
  const [stakeholder, setStakeholder] = useState("")
  const [response, setResponse] = useState("")
  const [documentName, setDocumentName] = useState("")
  const [documentNote, setDocumentNote] = useState("")
  const meta = META[module]

  // ---- full audit trail (paged, searchable, live) ----
  const [audit, setAudit] = useState<any[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditQ, setAuditQ] = useState("")
  const [auditBusy, setAuditBusy] = useState(false)
  const [auditPage, setAuditPage] = useState(1)
  const [auditPreview, setAuditPreview] = useState(false)
  const AUDIT_PAGE = 15
  const fetchAudit = async (offset: number, limit: number, q: string) => {
    const r = await fetch(`/api/activity/full?offset=${offset}&limit=${limit}&q=${encodeURIComponent(q)}`)
    if (r.ok) return (await r.json()) as { activity: any[]; total: number }
    // Fallback: the original activity endpoint, so the list is never blank if the new route isn't deployed yet
    const f = await fetch("/api/activity")
    if (!f.ok) throw new Error("Could not load the audit trail. Please refresh and try again.")
    const needle = q.toLowerCase()
    const rows = ((await f.json()).activity || []).filter((a: any) => !needle || `${a.user} ${a.action} ${a.application || ""}`.toLowerCase().includes(needle))
    return { activity: rows.slice(offset, offset + limit), total: rows.length }
  }
  const auditSheet = (() => {
    const columns = ["Time", "User", "Action", "Application"]
    const sheet: RPCell[][] = audit.map(a => [new Date(a.createdAt).toLocaleString(), a.user, a.action, a.application || ""])
    const actions = tally(audit.map(a => a.action))
    const top = actions.slice(0, 4), other = actions.slice(4).reduce((n, i) => n + i.value, 0)
    const days = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() - (6 - k)); return d })
    const perDay = days.map(d => ({ label: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }), value: audit.filter(a => new Date(a.createdAt).toDateString() === d.toDateString()).length }))
    return { columns, sheet, summaries: [
      { title: "By action", kind: "stack" as const, items: withColors(other ? [...top, { label: "Other", value: other }] : top) },
      { title: "Last 7 days", kind: "stack" as const, items: withColors(perDay) },
      { title: "Activity by person", kind: "bars" as const, items: tally(audit.map(a => a.user)).slice(0, 5) },
    ] }
  })()
  const auditPages = Math.max(1, Math.ceil(audit.length / AUDIT_PAGE))
  const mergeAudit = (fresh: any[], old: any[]) => { const ids = new Set(fresh.map(a => a.id)); return [...fresh, ...old.filter(a => !ids.has(a.id))] }
  useEffect(() => { setAudit([]); setAuditPage(1) }, [auditQ])
  useEffect(() => {
    if (module !== "activity") return
    const t = setTimeout(() => { fetchAudit(0, 200, auditQ).then(d => { setAudit(prev => mergeAudit(d.activity, prev)); setAuditTotal(d.total) }).catch(e => setNotice(e.message)) }, auditQ ? 300 : 0)
    return () => clearTimeout(t)
  }, [module, tick, auditQ])
  async function exportAudit() {
    setAuditBusy(true)
    try {
      const rows: any[] = []
      for (let offset = 0; ; offset += 1000) { const d = await fetchAudit(offset, 1000, auditQ); rows.push(...d.activity); if (d.activity.length < 1000 || rows.length >= d.total) break }
      const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`
      const csv = ["time,user,action,application", ...rows.map(a => [new Date(a.createdAt).toISOString(), a.user, a.action, a.application].map(esc).join(","))].join("\n")
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
      const link = document.createElement("a"); link.href = url; link.download = "spatial-planning-audit-trail.csv"; link.click(); URL.revokeObjectURL(url)
    } catch (e: any) { setNotice(e.message) }
    setAuditBusy(false)
  }

  const loadConsultations = () => fetch("/api/consultations").then(r => r.json()).then(d => setConsultations(d.consultations || []))
  useEffect(() => {
    if (module === "consultations") loadConsultations()
    if (module === "team" || module === "user-management") fetch("/api/team").then(r => r.json()).then(d => setStaff(d.users || []))
  }, [module, tick])

  async function submitConsultation(e: FormEvent) {
    e.preventDefault()
    const r = await fetch("/api/consultations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId, stakeholder, response }) })
    const d = await r.json()
    setNotice(r.ok ? "Response saved successfully." : d.error)
    if (r.ok) { setStakeholder(""); setResponse(""); loadConsultations(); reload() }
  }
  async function submitDocument(e: FormEvent) {
    e.preventDefault()
    const r = await fetch(`/api/applications/${applicationId}/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: documentName, description: documentNote }) })
    const d = await r.json()
    setNotice(r.ok ? "Document entry saved." : d.error)
    if (r.ok) { setDocumentName(""); setDocumentNote(""); reload() }
  }

  const appSelect = (
    <label className="pt-field">Application
      <select className="pt-in" required value={applicationId} onChange={e => setApplicationId(e.target.value)}>
        <option value="">Select application</option>{apps.map(a => <option key={a.id} value={a.id}>{a.reference} — {a.applicant}</option>)}
      </select>
    </label>
  )
  const awaiting = apps.filter(a => MGMT_STAGES.includes(normStage(a.stage)) && !FINAL_STATUSES.includes(a.status))
  const stats: StatItem[] | undefined = module === "reports" ? [
    { key: "t", label: "Total Applications", value: apps.length, tone: "blue", icon: FileText },
    { key: "p", label: "In Progress", value: apps.filter(a => a.status === "In progress").length, tone: "green", icon: Clock3 },
    { key: "r", label: "In Review", value: awaiting.length, tone: "orange", icon: Hourglass },
    { key: "a", label: "Approved", value: apps.filter(a => a.status === "Approved").length, tone: "green", icon: CircleCheck },
    { key: "x", label: "Rejected", value: apps.filter(a => a.status === "Rejected").length, tone: "red", icon: CircleX },
  ] : undefined
  const types = Array.from(new Set(apps.map(a => a.type)))

  return (
    <PortalShell role={role as Role} name={name} notice={notice} onDismiss={() => setNotice("")} eyebrow="WORKSPACE" title={meta?.[0] || "Workspace"} subtitle={meta?.[1] || "Select a workspace module."} stats={stats} heroClass={module === "team" ? "pt-hero-team" : undefined}>
      <div className="pt-stack">
        {module === "management-review" && (
          <section className="pt-card">
            <CardHead icon={FileCheck2} title="Awaiting Management action" sub="Review, committee, Council and permit approval" count={`${awaiting.length}`} />
            <div className="pt-list">
              {awaiting.map(a => (
                <div key={a.id} className="pt-row">
                  <div><Link href={`/applications/${a.id}`} className="pt-ref">{a.reference}</Link> · <strong>{a.applicant}</strong><p>{a.type} — {a.stand}</p></div>
                  <div className="pt-row"><span className="pt-pill blue">{normStage(a.stage)}</span><StatusPill status={a.status} /><Link href={`/applications/${a.id}`} className="pt-btn pri sm">Open record</Link></div>
                </div>
              ))}
              {awaiting.length === 0 && <div><small>Nothing is waiting for Management right now.</small></div>}
            </div>
          </section>
        )}

        {module === "consultations" && <>
          <form className="pt-card" onSubmit={submitConsultation}>
            <CardHead icon={MessageSquareText} title="Record a consultation response" sub="Capture feedback from a stakeholder against an application" />
            <div className="pt-form">
              {appSelect}
              <label className="pt-field">Stakeholder<input className="pt-in" required value={stakeholder} onChange={e => setStakeholder(e.target.value)} /></label>
              <label className="pt-field">Response<textarea className="pt-in" required rows={4} value={response} onChange={e => setResponse(e.target.value)} /></label>
              <div><button type="submit" className="pt-btn pri"><Save size={17} />Save response</button></div>
            </div>
          </form>
          <section className="pt-card">
            <CardHead icon={Users} title="Saved responses" count={`${consultations.length}`} />
            <div className="pt-list">
              {consultations.map(c => <div key={c.id}><strong>{c.reference} — {c.stakeholder}</strong><p>{c.response}</p><small>{new Date(c.createdAt).toLocaleString()}</small></div>)}
              {consultations.length === 0 && <div><small>No responses recorded yet.</small></div>}
            </div>
          </section>
        </>}

        {module === "reports" && (
          <section className="pt-card">
            <CardHead icon={ChartColumn} title="Applications by type" sub="Share of the register for each application type" />
            <div className="pt-bars">
              {types.map(t => { const n = apps.filter(a => a.type === t).length; return <div key={t}><span>{t}</span><span className="bar"><i style={{ width: `${(n / Math.max(1, apps.length)) * 100}%` }} /></span><strong>{n}</strong></div> })}
              {types.length === 0 && <small>No applications recorded yet.</small>}
            </div>
          </section>
        )}

        {module === "activity" && (
          <section className="pt-card">
            <CardHead icon={Activity} title="Activity audit trail" count={`${auditTotal} entries`} sub="The 100 most recent actions, newest first. Entries cannot be edited or deleted; the oldest drops off automatically. Updates live."
              right={<div className="pt-acts"><button className="pt-btn sm" disabled={audit.length === 0} onClick={() => setAuditPreview(true)}><FileSpreadsheet size={16} />Preview</button><button className="pt-btn sm" disabled={auditBusy || auditTotal === 0} onClick={exportAudit}><Download size={16} />Export all (CSV)</button></div>} />
            <div className="pt-tools"><label className="pt-search"><Search size={18} /><input value={auditQ} onChange={e => setAuditQ(e.target.value)} placeholder="Search by person, action or application…" aria-label="Search the audit trail" /></label></div>
            <div className="pt-list" style={{ marginTop: 12 }}>
              {audit.slice((Math.min(auditPage, auditPages) - 1) * AUDIT_PAGE, Math.min(auditPage, auditPages) * AUDIT_PAGE).map(a => <div key={a.id}><strong>{a.user}</strong> {a.action} {a.application && <Link className="pt-ref" href={`/applications/${encodeURIComponent(a.application)}`}>{a.application}</Link>}<br /><small>{new Date(a.createdAt).toLocaleString()}</small></div>)}
              {audit.length === 0 && <div><small>{auditQ ? "No entries match your search." : "No activity recorded yet."}</small></div>}
            </div>
            <div className="pt-foot">
              <span>Showing {audit.length === 0 ? 0 : (Math.min(auditPage, auditPages) - 1) * AUDIT_PAGE + 1}–{Math.min(Math.min(auditPage, auditPages) * AUDIT_PAGE, audit.length)} of {audit.length}</span>
              <div className="pt-pager">
                <button disabled={auditPage <= 1} onClick={() => setAuditPage(p => Math.max(1, p - 1))}>Previous</button>
                <span style={{ fontWeight: 600 }}>Page {Math.min(auditPage, auditPages)} of {auditPages}</span>
                <button disabled={auditPage >= auditPages} onClick={() => setAuditPage(p => p + 1)}>Next</button>
              </div>
            </div>
          </section>
        )}

        {module === "team" && (
          <section className="pt-card">
            <CardHead icon={Users} title="Staff directory" count={`${staff.length}`} />
            <div className="pt-tw"><table className="pt-table" style={{ minWidth: 560 }}>
              <thead><tr><th>User</th><th>Role</th><th>Status</th></tr></thead>
              <tbody>
                {staff.map((u, i) => <tr key={u.id}><td><div className="pt-ucell"><span className="pt-avatar" style={{ background: ["#5b7aa8", "#1e9a3f", "#f08a14", "#7a45c9"][i % 4] }}>{initials(u.name)}</span><span><strong>{u.name}</strong><span className="pt-t2">{u.email}</span></span></div></td><td>{u.role}</td><td><span className={`pt-pill ${u.status === "Active" ? "green" : "amber"}`}>{u.status}</span></td></tr>)}
                {staff.length === 0 && <tr><td colSpan={3} className="pt-empty">No staff records available.</td></tr>}
              </tbody></table></div>
          </section>
        )}

        {module === "documents" && <>
          <form className="pt-card" onSubmit={submitDocument}>
            <CardHead icon={Files} title="Add document register entry" sub="Log a document received for an application" />
            <div className="pt-form">
              {appSelect}
              <label className="pt-field">Document name<input className="pt-in" required value={documentName} onChange={e => setDocumentName(e.target.value)} /></label>
              <label className="pt-field">Description / received notes<textarea className="pt-in" rows={3} value={documentNote} onChange={e => setDocumentNote(e.target.value)} /></label>
              <div><button type="submit" className="pt-btn pri"><Save size={17} />Save document entry</button></div>
            </div>
          </form>
          <section className="pt-card">
            <CardHead icon={FileText} title="Document register" count={`${apps.length}`} />
            <div className="pt-list">
              {apps.map(a => (
                <div key={a.id}><Link href={`/applications/${a.id}`} className="pt-ref">{a.reference} — {a.applicant}</Link><p>{a.documents?.length || 0} document entry/entries</p>
                  {(a.documents || []).map((d: any) => <small key={d.id} style={{ display: "block" }}>{d.name} — {d.description}</small>)}</div>
              ))}
            </div>
          </section>
        </>}

        {module === "user-management" && role === "Senior officer" && (
          <section className="pt-card"><CardHead icon={Users} title="Accounts administration" sub="Create staff accounts and change roles" right={<Link href="/senior-dashboard" className="pt-btn pri sm">Open account management</Link>} /></section>
        )}

        {!meta && <section className="pt-card"><CardHead title="Module not found" sub="Select a workspace module from the navigation." /></section>}
      </div>
    {auditPreview && <ReportPreview filename="spatial-planning-audit-trail.csv" columns={auditSheet.columns} rows={auditSheet.sheet} summaries={auditSheet.summaries} onClose={() => setAuditPreview(false)} />}
    </PortalShell>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, CalendarDays, ChartColumn, ChevronDown, CircleCheck, Clock3, Download, Eye, FileSpreadsheet, FilePlus2, FolderOpen, Info, MoreHorizontal, Pencil, Search, SlidersHorizontal, Zap } from "lucide-react"
import { useLiveTick } from "@/lib/live"
import { normStage } from "@/lib/workflow"
import ReportPreview, { tally, withColors, type RPCell } from "@/components/report-preview"
import { CardHead, DATE_RANGES, STAGES, STATUS_FILTERS, StatusPill, PortalShell, appStatItems, inRange, matchStatus, useApps, useGreeting, firstName, type Role } from "@/components/portal"

export default function PlanningDashboard({ role, name }: { role: Role; name: string }) {
  const router = useRouter()
  const greeting = useGreeting()
  const isManager = role === "Management"
  const { apps, error } = useApps()
  const tick = useLiveTick()
  const [activity, setActivity] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [range, setRange] = useState("any")
  const [notice, setNotice] = useState("")
  const [preview, setPreview] = useState(false)
  useEffect(() => { fetch("/api/activity").then(r => r.json()).then(d => setActivity(d.activity || [])).catch(() => {}) }, [tick])
  useEffect(() => { if (error) setNotice(error) }, [error])

  const rows = useMemo(() => apps.filter(a =>
    `${a.reference} ${a.applicant} ${a.type} ${a.stand} ${a.officer}`.toLowerCase().includes(search.toLowerCase()) && matchStatus(a, status) && inRange(a.received, range)
  ), [apps, search, status, range])

  const stageRows = STAGES.map(s => ({ ...s, count: apps.filter(a => normStage(a.stage) === s.label).length }))
  const staged = stageRows.reduce((n, s) => n + s.count, 0)
  const maxStage = Math.max(1, ...stageRows.map(s => s.count))
  let acc = 0
  const donut = staged ? `conic-gradient(${stageRows.filter(s => s.count).map(s => { const from = acc; acc += (s.count / staged) * 100; return `${s.color} ${from}% ${acc}%` }).join(",")})` : "#e3ecf8"

  const sheet = (() => {
    const columns = ["Reference", "Applicant", "Type", "Property", "Stage", "Officer", "Received", "Due", "Status"]
    const cells: RPCell[][] = apps.map(a => [a.reference, a.applicant, a.type, a.stand, normStage(a.stage), a.officer, a.received, a.due || "", a.status])
    return { columns, cells, summaries: [
      { title: "By status", kind: "stack" as const, items: withColors(tally(apps.map(a => a.status))) },
      { title: "By stage", kind: "stack" as const, items: withColors(tally(apps.map(a => normStage(a.stage)))) },
      { title: "By application type", kind: "bars" as const, items: tally(apps.map(a => a.type)).slice(0, 6) },
    ] }
  })()
  function exportCSV() {
    const cols = ["reference", "applicant", "type", "stand", "stage", "officer", "received", "due", "status"]
    const csv = [cols.join(","), ...apps.map(a => cols.map(k => `"${String(a[k] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a"); link.href = url; link.download = "spatial-planning-applications.csv"; link.click(); URL.revokeObjectURL(url)
  }
  const open = (a: { id?: string; reference: string }) => router.push(`/applications/${a.id || encodeURIComponent(a.reference)}`)

  return (
    <PortalShell
      role={role} name={name} notice={notice} onDismiss={() => setNotice("")}
      eyebrow="DEPARTMENT OVERVIEW"
      title={`${greeting}, ${firstName(name)}.`}
      subtitle={isManager ? "Here’s what’s happening today in Spatial Planning." : "Your applications, consultations and deadlines at a glance."}
      actions={<><button className="pt-btn" disabled={apps.length === 0} onClick={() => setPreview(true)}><FileSpreadsheet size={18} />Preview</button><button className="pt-btn" onClick={exportCSV}><Download size={18} />Export report</button><button className="pt-btn pri" onClick={() => router.push("/applications/new")}><FilePlus2 size={18} />New application</button></>}
      stats={appStatItems(apps, "dash", key => router.push(`/applications?status=${encodeURIComponent(key)}`))}
    >
      <div className="pt-grid2">
        <section className="pt-card">
          <CardHead icon={ChartColumn} title="Applications by Stage" sub="Current distribution across the workflow process" />
          <div className="pt-stage-wrap">
            <div className="pt-stages">
              {stageRows.map(s => (
                <button key={s.label} className="pt-stage" onClick={() => router.push("/applications")} aria-label={`${s.label}: ${s.count}`}>
                  <span className="pt-dot" style={{ background: s.color }} /><span>{s.label}</span>
                  <span className="bar"><i style={{ width: `${(s.count / maxStage) * 100}%`, background: s.color }} /></span><em>{s.count}</em>
                </button>
              ))}
            </div>
            <div className="pt-donut" style={{ background: donut }}><div><b>{apps.length}</b><span>Total Apps</span></div></div>
          </div>
          <button className="pt-link" style={{ marginTop: 18 }} onClick={() => router.push("/applications")}>View all applications <ArrowRight size={16} /></button>
        </section>

        <section className="pt-card">
          <CardHead icon={Zap} title="Recent Activity" sub="Latest updates on your applications" right={<button className="pt-link" onClick={() => router.push("/workspace/activity")}>View all <ArrowRight size={16} /></button>} />
          <div className="pt-act"><ul>
            {activity.slice(0, 5).map((e, i) => (
              <li key={e.id || i}>
                <span className={`pt-act-ic ${i % 3 === 1 ? "b" : i % 3 === 2 ? "o" : ""}`}>{i % 3 === 1 ? <Info size={14} /> : i % 3 === 2 ? <Clock3 size={14} /> : <CircleCheck size={14} />}</span>
                <span><strong>{e.user} {e.action}</strong>{e.application && <small>Application #{e.application}</small>}</span>
                <time>{new Date(e.createdAt).toLocaleDateString("en-GB")}</time>
              </li>
            ))}
            {activity.length === 0 && <li><span /><span><small>No activity recorded yet.</small></span><span /></li>}
          </ul></div>
        </section>
      </div>

      <section className="pt-card">
        <CardHead icon={FolderOpen} title={isManager ? "Recent Applications" : "My Applications"} count={`${rows.length} records`} sub={isManager ? "Track and manage your department’s latest submissions" : "Applications assigned to you, newest first"}
          right={<button className="pt-btn pri sm" onClick={() => router.push("/applications")}>View all applications <ArrowRight size={16} /></button>} />
        <div className="pt-tools">
          <label className="pt-search"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search applications..." aria-label="Search applications" /></label>
          <label className="pt-sel"><SlidersHorizontal size={16} /><select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status">{STATUS_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><ChevronDown size={15} /></label>
          <label className="pt-sel"><CalendarDays size={16} /><select value={range} onChange={e => setRange(e.target.value)} aria-label="Filter by date received">{DATE_RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><ChevronDown size={15} /></label>
        </div>
        <div className="pt-tw">
          <table className="pt-table">
            <thead><tr><th>Ref. Number</th><th>Applicant</th><th>Property</th><th>Application Type</th><th>Officer</th><th>Status</th><th style={{ textAlign: "right", paddingRight: 18 }}>Actions</th></tr></thead>
            <tbody>
              {rows.slice(0, 6).map(a => (
                <tr key={a.reference}>
                  <td><button className="pt-ref" onClick={() => open(a)}>{a.reference}</button></td>
                  <td>{a.applicant}</td><td>{a.stand}</td><td>{a.type}</td><td>{a.officer}</td><td><StatusPill status={a.status} /></td>
                  <td><div className="pt-ra"><button aria-label={`View ${a.reference}`} onClick={() => open(a)}><Eye size={18} /></button><button aria-label={`Edit ${a.reference}`} onClick={() => open(a)}><Pencil size={17} /></button><button aria-label={`More for ${a.reference}`} onClick={() => open(a)}><MoreHorizontal size={18} /></button></div></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="pt-empty">No applications match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    {preview && <ReportPreview filename="spatial-planning-applications.csv" columns={sheet.columns} rows={sheet.cells} summaries={sheet.summaries} onClose={() => setPreview(false)} />}
    </PortalShell>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarDays, ChevronDown, Eye, FileSpreadsheet, MoreHorizontal, Plus, Search, SlidersHorizontal, SquarePen } from "lucide-react"
import ReportPreview, { tally, withColors, type RPCell } from "@/components/report-preview"
import { DATE_RANGES, PortalShell, STATUS_FILTERS, StatusPill, appStatItems, inRange, matchStatus, useApps, type Role } from "@/components/portal"

const PAGE = 10

export default function ApplicationsClient({ role, name }: { role: string; name: string }) {
  const router = useRouter()
  const { apps, error } = useApps()
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("all")
  const [range, setRange] = useState("any")
  const [filters, setFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status")
    if (s && STATUS_FILTERS.some(([k]) => k === s)) { setStatus(s); setFilters(true) }
  }, [])
  useEffect(() => setPage(1), [q, status, range])

  const rows = useMemo(() => apps.filter(a =>
    `${a.reference} ${a.applicant} ${a.type} ${a.stand} ${a.stage} ${a.officer}`.toLowerCase().includes(q.toLowerCase()) && matchStatus(a, status) && inRange(a.received, range)
  ), [apps, q, status, range])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const shown = rows.slice((page - 1) * PAGE, page * PAGE)
  const TONE: Record<string, "yellow" | "orange" | "red" | "green" | "grey"> = { "In progress": "yellow", Review: "orange", Overdue: "red", Approved: "green", Rejected: "red", Closed: "grey" }
  const LABEL: Record<string, string> = { "In progress": "In progress", Review: "Pending review" }
  const previewData = useMemo(() => {
    const columns = ["Reference", "Applicant", "Type", "Property", "Stage", "Officer", "Received", "Due", "Status"]
    const sheet: RPCell[][] = rows.map(a => [a.reference, a.applicant, a.type, a.stand, a.stage, a.officer, a.received, a.due, { text: LABEL[a.status] || a.status, tone: TONE[a.status] || "grey" }])
    const count = (s: string) => rows.filter(a => a.status === s).length
    const statusItems = [["In progress", "#2a7aa4"], ["Review", "#d9951b"], ["Overdue", "#c0392b"], ["Approved", "#2e9a5a"], ["Rejected", "#8e6bbf"], ["Closed", "#5b6b7c"]].map(([s, color]) => ({ label: LABEL[s] || s, value: count(s), color }))
    const officers = tally(rows.map(a => a.officer)).slice(0, 5).map(i => ({ ...i, warn: /unassigned/i.test(i.label) }))
    return { columns, sheet, summaries: [
      { title: "By status", kind: "stack" as const, items: statusItems },
      { title: "By type", kind: "stack" as const, items: withColors(tally(rows.map(a => a.type)).slice(0, 5)) },
      { title: "Workload by officer", kind: "bars" as const, items: officers },
    ] }
  }, [rows])
  const open = (id?: string, ref?: string) => router.push(`/applications/${id || encodeURIComponent(ref || "")}`)

  return (
    <PortalShell
      role={role as Role} name={name} notice={error}
      eyebrow="APPLICATIONS" title="Applications" subtitle={`Logged-in as: ${name} · ${role}`}
      actions={role !== "Senior officer" ? <Link href="/applications/new" className="pt-btn grn"><Plus size={19} />New Application</Link> : undefined}
      stats={appStatItems(apps, "list", key => setStatus(s => s === key ? "all" : key), status)}
    >
      <section className="pt-card">
        <div className="pt-tools">
          <label className="pt-search"><Search size={19} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search reference, applicant, property, officer…" aria-label="Search applications" /></label>
          <button className="pt-btn" onClick={() => setPreview(true)}><FileSpreadsheet size={18} />Preview</button>
          <button className="pt-sq" aria-label="Show filters" aria-expanded={filters} onClick={() => setFilters(f => !f)}><SlidersHorizontal size={20} /></button>
        </div>
        {filters && (
          <div className="pt-tools" style={{ marginTop: 12 }}>
            <label className="pt-sel"><SlidersHorizontal size={16} /><select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status">{STATUS_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><ChevronDown size={15} /></label>
            <label className="pt-sel"><CalendarDays size={16} /><select value={range} onChange={e => setRange(e.target.value)} aria-label="Filter by date received">{DATE_RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><ChevronDown size={15} /></label>
          </div>
        )}
        <div className="pt-tw">
          <table className="pt-table">
            <thead><tr><th>Reference</th><th>Applicant</th><th>Type</th><th>Property</th><th>Stage</th><th>Officer</th><th>Status</th><th style={{ textAlign: "right", paddingRight: 18 }}>Actions</th></tr></thead>
            <tbody>
              {shown.map(a => (
                <tr key={a.id || a.reference}>
                  <td><Link className="pt-ref" href={`/applications/${a.id || encodeURIComponent(a.reference)}`}>{a.reference}</Link></td>
                  <td>{a.applicant}</td><td>{a.type}</td><td>{a.stand}</td><td>{a.stage}</td><td>{a.officer}</td><td><StatusPill status={a.status} /></td>
                  <td><div className="pt-ra"><button aria-label={`View ${a.reference}`} onClick={() => open(a.id, a.reference)}><Eye size={18} /></button><button aria-label={`Edit ${a.reference}`} onClick={() => open(a.id, a.reference)}><SquarePen size={17} /></button><button aria-label={`More for ${a.reference}`} onClick={() => open(a.id, a.reference)}><MoreHorizontal size={18} /></button></div></td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={8} className="pt-empty">No matching application records.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pt-foot">
          <span>{rows.length} matching record(s)</span>
          <div className="pt-pager">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            {Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2).map(n => <button key={n} className={n === page ? "on" : ""} onClick={() => setPage(n)} aria-label={`Page ${n}`}>{n}</button>)}
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      </section>
    {preview && <ReportPreview filename="spatial-planning-applications.csv" columns={previewData.columns} rows={previewData.sheet} summaries={previewData.summaries} onClose={() => setPreview(false)} />}
    </PortalShell>
  )
}

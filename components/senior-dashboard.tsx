"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { ArrowRight, ChevronDown, Download, FileSpreadsheet, FilePlus2, Lock, Mail, MoreHorizontal, Plus, Search, ShieldCheck, SlidersHorizontal, Users, X } from "lucide-react"
import { useLiveTick } from "@/lib/live"
import ReportPreview, { tally, withColors, type RPCell } from "@/components/report-preview"
import { CardHead, PortalShell, firstName, initials, useGreeting, type StatItem } from "@/components/portal"

type StaffRole = "Senior officer" | "Management" | "Planning officer"
type StaffMember = { id: number | string; name: string; email: string; role: StaffRole; status: "Active" | "Setup pending" }

const roleDescriptions: Record<StaffRole, string> = {
  "Senior officer": "Create staff accounts and assign roles",
  Management: "Review applications and team workload",
  "Planning officer": "Work on assigned applications and consultations",
}
const AVATARS = ["#5b7aa8", "#1e9a3f", "#f08a14", "#7a45c9"]

export default function SeniorDashboard({ seniorName }: { seniorName: string }) {
  const greeting = useGreeting()
  const tick = useLiveTick()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<StaffRole>("Planning officer")
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [notice, setNotice] = useState("")
  const [showForm, setShowForm] = useState(true)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    fetch("/api/admin/users").then(r => r.ok ? r.json() : Promise.reject()).then(data => setStaff(data.users.map((u: any) => ({ ...u, status: u.status || "Active" }))))
      .catch(() => setNotice("Could not load saved users. Ensure you are signed in as Senior Officer."))
  }, [tick])

  const filtered = useMemo(() => staff.filter(m => `${m.name} ${m.email} ${m.role}`.toLowerCase().includes(query.toLowerCase()) && (roleFilter === "all" || m.role === roleFilter)), [staff, query, roleFilter])

  const sheet = (() => {
    const columns = ["Name", "Email", "Role", "Status"]
    const cells: RPCell[][] = staff.map(u => [u.name, u.email, u.role, u.status])
    return { columns, cells, summaries: [
      { title: "By role", kind: "stack" as const, items: withColors(tally(staff.map(u => u.role))) },
      { title: "By account status", kind: "stack" as const, items: withColors(tally(staff.map(u => u.status))) },
    ] }
  })()
  function exportUsersCSV() {
    const csv = ["name,email,role,status", ...staff.map(u => `"${u.name}","${u.email}","${u.role}","${u.status}"`)].join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a"); a.href = url; a.download = "spatial-planning-users.csv"; a.click(); URL.revokeObjectURL(url)
  }

  async function addStaffMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, role, password }) })
      const result = await response.json()
      if (!response.ok) { setNotice(result.error || "Unable to create user."); return }
      setStaff(current => [...current, { ...result.user, status: "Active" }])
      setNotice(`${name.trim()} was created successfully with ${role} access.`)
      setName(""); setEmail(""); setPassword("")
    } catch { setNotice("Unable to connect to the account service.") }
  }

  async function changeRole(id: number | string, nextRole: StaffRole) {
    const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, role: nextRole }) })
    const result = await response.json()
    if (!response.ok) { setNotice(result.error || "Role update failed."); return }
    setStaff(current => current.map(m => m.id === id ? { ...m, role: nextRole } : m))
    setNotice("Role saved to the accounts JSON file.")
  }

  async function toggleStatus(member: StaffMember) {
    const next = member.status === "Active" ? "Setup pending" : "Active"
    const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: member.id, status: next }) })
    const out = await res.json()
    if (!res.ok) { setNotice(out.error || "Could not update account status."); return }
    setStaff(current => current.map(m => m.id === member.id ? { ...m, status: next } : m))
    setNotice(`${member.name} account status saved as ${next}.`)
  }

  const stats: StatItem[] = [
    { key: "users", label: "Department Users", value: staff.length, tone: "blue", icon: Users },
    { key: "active", label: "Active Accounts", value: staff.filter(m => m.status === "Active").length, tone: "green", icon: ShieldCheck },
    { key: "pending", label: "Setup Pending", value: staff.filter(m => m.status === "Setup pending").length, tone: "orange", icon: Mail },
    { key: "roles", label: "Roles Available", value: 3, tone: "purple", icon: SlidersHorizontal },
  ]

  return (
    <PortalShell role="Senior officer" name={seniorName} notice={notice} onDismiss={() => setNotice("")}
      eyebrow="DEPARTMENT ADMINISTRATION" title={`${greeting}, ${firstName(seniorName)}.`} subtitle="Manage department access and keep the right people in the right workspace."
      actions={<button className="pt-btn pri" onClick={() => { setShowForm(true); document.getElementById("new-staff-form")?.scrollIntoView({ behavior: "smooth", block: "center" }) }}><Plus size={18} />Add a user</button>}
      stats={stats}>
      <div className="pt-grid2" style={{ alignItems: "start" }}>
        <section className="pt-card">
          <CardHead icon={Users} title="Department Users" count={`${staff.length} ${staff.length === 1 ? "user" : "users"}`} sub="Review staff accounts and assign their workspace roles"
            right={<div className="pt-acts"><button className="pt-btn sm" disabled={staff.length === 0} onClick={() => setPreview(true)}><FileSpreadsheet size={16} />Preview</button><button className="pt-btn sm" onClick={exportUsersCSV}><Download size={16} />Export</button></div>} />
          <div className="pt-tools">
            <label className="pt-search"><Search size={18} /><input aria-label="Search users" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, email or role" /></label>
            <label className="pt-sel"><SlidersHorizontal size={16} /><select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} aria-label="Filter by role"><option value="all">All roles</option><option>Senior officer</option><option>Management</option><option>Planning officer</option></select><ChevronDown size={15} /></label>
          </div>
          <div className="pt-tw">
            <table className="pt-table" style={{ minWidth: 560 }}>
              <thead><tr><th>User</th><th>Role</th><th>Account status</th><th style={{ textAlign: "right", paddingRight: 18 }}>Actions</th></tr></thead>
              <tbody>
                {filtered.map((m, i) => (
                  <tr key={m.id}>
                    <td><div className="pt-ucell"><span className="pt-avatar" style={{ background: AVATARS[i % 4] }}>{initials(m.name)}</span><span><strong>{m.name}</strong><span className="pt-t2">{m.email}</span></span></div></td>
                    <td><label className="sr-only" htmlFor={`role-${m.id}`}>Role for {m.name}</label><select id={`role-${m.id}`} className="pt-in" style={{ minHeight: 38, width: 170 }} value={m.role} onChange={e => changeRole(m.id, e.target.value as StaffRole)}><option>Senior officer</option><option>Management</option><option>Planning officer</option></select></td>
                    <td><span className={`pt-pill ${m.status === "Active" ? "green" : "amber"}`}>{m.status}</span></td>
                    <td><div className="pt-ra"><button aria-label={`Toggle account status for ${m.name}`} title="Toggle Active / Setup pending" onClick={() => toggleStatus(m)}><MoreHorizontal size={18} /></button></div></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={4} className="pt-empty">No users match that search.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="pt-foot"><span>Showing {filtered.length} of {staff.length} users</span></div>
        </section>

        <section className="pt-card" id="new-staff-form">
          <CardHead icon={FilePlus2} title="Create a user" sub="Create a staff login with a role and password"
            right={<button className="pt-sq" aria-label={showForm ? "Collapse create-user form" : "Expand create-user form"} onClick={() => setShowForm(o => !o)}>{showForm ? <X size={18} /> : <Plus size={18} />}</button>} />
          {showForm && (
            <form className="pt-form" onSubmit={addStaffMember}>
              <label className="pt-field">Full name<input className="pt-in" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rudo Ncube" required /></label>
              <label className="pt-field">Department email<input className="pt-in" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@department.gov" required /></label>
              <label className="pt-field">Initial password<input className="pt-in" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} placeholder="At least 8 characters" required /></label>
              <label className="pt-field">Assign role<select className="pt-in" value={role} onChange={e => setRole(e.target.value as StaffRole)}><option>Planning officer</option><option>Management</option><option>Senior officer</option></select></label>
              <div className="pt-note info"><ShieldCheck size={17} /><span>{roleDescriptions[role]}</span></div>
              <div className="pt-note warn" style={{ background: "#fee2e2", borderColor: "#fca5a5", color: "#b91c1c", fontWeight: 600 }}><Lock size={17} /><span>Passwords are stored as salted hashes in the JSON file, not as readable text. Don’t use JSON-file storage for a public production deployment.</span></div>
              <button className="pt-btn pri" type="submit">Create account <ArrowRight size={17} /></button>
            </form>
          )}
        </section>
      </div>
    {preview && <ReportPreview filename="spatial-planning-users.csv" columns={sheet.columns} rows={sheet.cells} summaries={sheet.summaries} onClose={() => setPreview(false)} />}
    </PortalShell>
  )
}

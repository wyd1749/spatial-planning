"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { ArrowLeft, FilePlus2, Save } from "lucide-react"
import { CardHead, PortalShell, type Role } from "@/components/portal"

const FIELDS: [string, string, string, boolean][] = [
  ["applicant", "Applicant name", "text", true], ["email", "Applicant email", "email", false],
  ["phone", "Phone number", "text", false], ["due", "Due date (4 months for Subdivision, 3 months for other types)", "date", false],
  ["stand", "Property / stand details", "text", true],
]
const TYPES = ["Subdivision", "Special consent", "Change of use", "Consolidation", "New development", "Other"]
const months = (t: string) => (t === "Subdivision" ? 4 : 3)
const dueFor = (t: string) => { const d = new Date(); d.setMonth(d.getMonth() + months(t)); return d.toISOString().slice(0, 10) }

export default function NewApplication({ role, name }: { role: string; name: string }) {
  const [form, setForm] = useState<Record<string, string>>({ applicant: "", email: "", phone: "", type: "Subdivision", stand: "", due: dueFor("Subdivision"), description: "" })
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)
  const [dueTouched, setDueTouched] = useState(false)
  const set = (k: string, v: string) => { if (k === "due") setDueTouched(true); setForm(x => ({ ...x, [k]: v, ...(k === "type" && !dueTouched ? { due: dueFor(v) } : {}) })) }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg("Saving…")
    try {
      const res = await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      const d = await res.json()
      if (!res.ok) { setMsg(d.error || "Failed to save"); setBusy(false); return }
      location.href = `/applications/${d.application.id}`
    } catch { setMsg("Could not reach the server. Try again."); setBusy(false) }
  }

  return (
    <PortalShell role={role as Role} name={name} notice={msg} onDismiss={() => setMsg("")}
      eyebrow="NEW APPLICATION" title="Register application" subtitle={`Registrar: ${name} · ${role}`}
      actions={<Link href="/applications" className="pt-btn"><ArrowLeft size={18} />Back to applications</Link>}>
      <form className="pt-card" onSubmit={submit} style={{ maxWidth: 900 }}>
        <CardHead icon={FilePlus2} title="Application details" sub="Fields marked with * are required" />
        <div className="pt-form two">
          {FIELDS.map(([k, label, type, req]) => (
            <label key={k} className={`pt-field ${k === "stand" ? "full" : ""}`}>{label}{req && " *"}
              <input className="pt-in" required={req} type={type} value={form[k]} onChange={e => set(k, e.target.value)} />
            </label>
          ))}
          <label className="pt-field full">Application type
            <select className="pt-in" value={form.type} onChange={e => set("type", e.target.value)}>{TYPES.map(x => <option key={x}>{x}</option>)}</select>
          </label>
          <label className="pt-field full">Application notes
            <textarea className="pt-in" rows={4} value={form.description} onChange={e => set("description", e.target.value)} />
          </label>
          <div className="full"><button type="submit" className="pt-btn pri" disabled={busy}><Save size={18} />Save application</button></div>
        </div>
      </form>
    </PortalShell>
  )
}

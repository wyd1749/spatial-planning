"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLiveStatus, useLiveTick } from "@/lib/live"
import { FINAL_STATUSES, MGMT_STAGES, WORKFLOW, normStage } from "@/lib/workflow"
import {
  Activity, ArrowRight, Ban, Bell, CalendarDays, ChartColumn, ChevronDown, CircleAlert, CircleCheck, CircleHelp, CircleX,
  ClipboardList, Clock3, FileCheck2, FilePlus2, FileText, Files, Hourglass, LayoutDashboard, Lock, LogOut, Menu, Search, Users, X,
  type LucideIcon,
} from "lucide-react"

/* ---------- shared types + helpers ---------- */
export type Role = "Senior officer" | "Management" | "Planning officer"
export type AppRec = { id?: string; reference: string; applicant: string; type: string; stand: string; stage: string; officer: string; received: string; due: string; status: string; [k: string]: any }

export const STAGES = WORKFLOW

export const STATUS_FILTERS: [string, string][] = [
  ["all", "All statuses"], ["In progress", "In progress"], ["pending", "Pending review"], ["Overdue", "Overdue"], ["Approved", "Approved"], ["Rejected", "Rejected"], ["Closed", "Closed"],
]
export const matchStatus = (a: AppRec, key: string) => key === "all" || (key === "pending" ? a.status === "Review" || a.status === "Overdue" : a.status === key)

export const DATE_RANGES: [string, string][] = [["any", "Any date"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["year", "This year"]]
export function inRange(received: string, range: string) {
  if (range === "any") return true
  const t = Date.parse(received)
  if (Number.isNaN(t)) return true
  if (range === "year") return new Date(t).getFullYear() === new Date().getFullYear()
  return Date.now() - t <= Number(range) * 86400000
}

export const initials = (n: string) => (n || "?").split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase()

export const firstName = (n: string) => { const f = (n || "").trim().split(/\s+/)[0] || ""; return f.charAt(0).toUpperCase() + f.slice(1) }

// 00:00-11:59 morning, 12:00-16:30 afternoon, 16:31-23:59 evening. Uses the device clock and re-checks every 30s.
const greetingNow = () => { const d = new Date(); const m = d.getHours() * 60 + d.getMinutes(); return m < 720 ? "Good morning" : m <= 990 ? "Good afternoon" : "Good evening" }
export function useGreeting() {
  const [g, setG] = useState("Welcome back")
  useEffect(() => { setG(greetingNow()); const t = setInterval(() => setG(greetingNow()), 30000); return () => clearInterval(t) }, [])
  return g
}

/** Past its due date and not finished = Overdue (worked out live, so nobody has to set it by hand). */
export function effectiveStatus<T extends { status: string; due?: string }>(a: T): T {
  if (FINAL_STATUSES.includes(a.status) || a.status === "Overdue") return a
  const due = Date.parse(a.due || "")
  return !Number.isNaN(due) && Date.now() > due + 86400000 ? { ...a, status: "Overdue" } : a
}

export function useApps() {
  const [apps, setApps] = useState<AppRec[]>([])
  const [error, setError] = useState("")
  const tick = useLiveTick()
  const reload = useCallback(() => fetch("/api/applications").then(r => r.ok ? r.json() : Promise.reject()).then(d => { setApps((d.applications || []).map(effectiveStatus)); setError("") }).catch(() => setError("Could not load application records.")), [])
  useEffect(() => { reload() }, [reload, tick])
  return { apps, error, reload }
}

export const countApps = (apps: AppRec[]) => ({
  total: apps.length,
  progress: apps.filter(a => a.status === "In progress").length,
  approved: apps.filter(a => a.status === "Approved").length,
  rejected: apps.filter(a => a.status === "Rejected").length,
  pending: apps.filter(a => a.status === "Review" || a.status === "Overdue").length,
})

/* ---------- status pill ---------- */
const PILL: Record<string, { label: string; cls: string; Icon: LucideIcon }> = {
  "In progress": { label: "In Progress", cls: "blue", Icon: Clock3 },
  Review: { label: "Pending", cls: "amber", Icon: Hourglass },
  Overdue: { label: "Overdue", cls: "red", Icon: CircleAlert },
  Approved: { label: "Approved", cls: "green", Icon: CircleCheck },
  Rejected: { label: "Rejected", cls: "red", Icon: CircleX },
  Closed: { label: "Closed", cls: "grey", Icon: Lock },
  Cancelled: { label: "Cancelled", cls: "grey", Icon: Ban },
}
export function StatusPill({ status }: { status: string }) {
  const p = PILL[status] || { label: status, cls: "grey", Icon: Clock3 }
  return <span className={`pt-pill ${p.cls}`}><p.Icon size={16} />{p.label}</span>
}

/* ---------- stat cards ---------- */
export type StatItem = { key: string; label: string; value: number | string; tone: string; icon: LucideIcon; onClick?: () => void; active?: boolean }
export function appStatItems(apps: AppRec[], variant: "dash" | "list", onClick?: (key: string) => void, active?: string): StatItem[] {
  const c = countApps(apps)
  const go = (key: string) => onClick ? () => onClick(key) : undefined
  return [
    { key: "all", label: "Total Applications", value: c.total, tone: "blue", icon: FileText },
    { key: "In progress", label: "In Progress", value: c.progress, tone: "green", icon: Clock3 },
    { key: "Approved", label: "Approved", value: c.approved, tone: variant === "dash" ? "green" : "orange", icon: CircleCheck },
    { key: "Rejected", label: "Rejected", value: c.rejected, tone: "red", icon: CircleX },
    { key: "pending", label: "Pending Review", value: c.pending, tone: variant === "dash" ? "orange" : "purple", icon: variant === "dash" ? Hourglass : ChartColumn },
  ].map(s => ({ ...s, onClick: go(s.key), active: active === s.key && s.key !== "all" }))
}
function StatCards({ items }: { items: StatItem[] }) {
  return (
    <section className="pt-stats" style={{ ["--n" as any]: items.length }} aria-label="Summary">
      {items.map(s => {
        const inner = <><span className="pt-stat-ic"><s.icon size={26} /></span><span><b>{s.value}</b><span className="l">{s.label}</span></span>{s.onClick && <span className="pt-stat-go"><ArrowRight size={15} /></span>}</>
        return s.onClick
          ? <button key={s.key} className={`pt-stat pt-${s.tone} ${s.active ? "on" : ""}`} onClick={s.onClick}>{inner}</button>
          : <div key={s.key} className={`pt-stat pt-${s.tone}`}>{inner}</div>
      })}
    </section>
  )
}

/* ---------- navigation per role ---------- */
type NavItem = { label: string; href: string; icon: LucideIcon; count?: "apps" | "review" }
const NAV: Record<Role, { main: NavItem[]; dept: NavItem[] }> = {
  Management: {
    main: [
      { label: "Dashboard", href: "/management-dashboard", icon: LayoutDashboard },
      { label: "Applications", href: "/applications", icon: ClipboardList, count: "apps" },
      { label: "Management review", href: "/workspace/management-review", icon: FileCheck2, count: "review" },
      { label: "Reports & Analytics", href: "/workspace/reports", icon: Activity },
      { label: "Team & Workload", href: "/workspace/team", icon: Users },
    ],
    dept: [{ label: "Documents", href: "/workspace/documents", icon: Files }, { label: "Activity log", href: "/workspace/activity", icon: Activity }],
  },
  "Planning officer": {
    main: [
      { label: "Dashboard", href: "/planning-dashboard", icon: LayoutDashboard },
      { label: "My applications", href: "/applications", icon: ClipboardList, count: "apps" },
      { label: "Consultations", href: "/workspace/consultations", icon: Files },
      { label: "Register application", href: "/applications/new", icon: FilePlus2 },
    ],
    dept: [],
  },
  "Senior officer": {
    main: [
      { label: "User management", href: "/senior-dashboard", icon: Users },
      { label: "Applications", href: "/applications", icon: ClipboardList, count: "apps" },
      { label: "Reports & Analytics", href: "/workspace/reports", icon: ChartColumn },
      { label: "Activity log", href: "/workspace/activity", icon: Activity },
    ],
    dept: [],
  },
}

/* ---------- decorative art ---------- */
function SideArt() {
  return (
    <svg className="pt-side-art" viewBox="0 70 240 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path d="M0 210V158C28 150 48 130 78 118L98 100 112 88 128 82 142 74 152 78 170 94 192 116C212 130 228 140 240 144V210Z" fill="#9fd0ff" />
      <path d="M0 210V176C40 168 70 150 110 146S190 160 240 150V210Z" fill="#6fb2f7" />
      {[[22, 168, 8, 42], [34, 160, 9, 50], [50, 170, 8, 40], [190, 162, 9, 48], [204, 154, 8, 56], [218, 166, 9, 44]].map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} fill="#bfe0ff" opacity=".7" />)}
    </svg>
  )
}
const BUILDINGS: [number, number, number][] = [[20, 70, 26], [52, 46, 30], [88, 62, 24], [118, 28, 34], [158, 56, 28], [192, 40, 22], [220, 66, 40], [266, 20, 30], [302, 52, 26], [334, 74, 34], [374, 44, 22], [402, 62, 30], [438, 34, 28], [472, 58, 36]]
export function FootArt() {
  return (
    <footer className="pt-art" aria-hidden="false">
      <svg viewBox="0 0 520 120" preserveAspectRatio="xMaxYMax meet" style={{ left: "auto", right: 24, width: 520 }}>
        {BUILDINGS.map(([x, y, w], i) => <rect key={i} x={x} y={y} width={w} height={120 - y} rx="2" fill="#7ab4ee" opacity={0.55 + (i % 3) * 0.1} />)}
        <path d="M281 20 L296 20 L288.5 4Z" fill="#7ab4ee" opacity=".7" />
      </svg>
      <svg viewBox="0 0 1600 120" preserveAspectRatio="none">
        <defs><linearGradient id="ptw" x1="0" x2="1"><stop offset="0" stopColor="#0a4fb8" /><stop offset="1" stopColor="#1a7cf0" /></linearGradient></defs>
        <path d="M0 62 C300 100 700 20 1100 64 S1500 80 1600 50 V120H0Z" fill="#8fc2f7" opacity=".45" />
        <path d="M0 84 C260 40 520 112 860 90 S1380 50 1600 76 V120H0Z" fill="url(#ptw)" />
      </svg>
      <div className="pt-credit" style={{ position: "absolute", left: 0, right: 0, bottom: 0, marginTop: 0 }}>
        <em>Planning Today… For a Better Tomorrow</em><span>Spatial Planning Department · City of Mutare</span>
      </div>
    </footer>
  )
}

/* ---------- the shell ---------- */
export function PortalShell({ role, name, eyebrow, title, subtitle, actions, stats, notice, onDismiss, children }: {
  role: Role; name: string; eyebrow: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; stats?: StatItem[]; notice?: string; onDismiss?: () => void; children: ReactNode
}) {
  const pathname = usePathname() || ""
  const nav = NAV[role]
  const all = [...nav.main, ...nav.dept]
  const current = all.filter(i => pathname === i.href || pathname.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0]
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [today, setToday] = useState("")
  const [counts, setCounts] = useState({ apps: 0, review: 0, attention: 0 })
  const tick = useLiveTick()
  const live = useLiveStatus()
  const [online, setOnline] = useState<{ id: string; name: string; role: string }[]>([])
  const [who, setWho] = useState(false)
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    const setDay = () => setToday(new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))
    setDay(); const t = setInterval(setDay, 60000); return () => clearInterval(t)
  }, [])
  useEffect(() => {
    fetch("/api/applications").then(r => r.ok ? r.json() : Promise.reject()).then(d => {
      const a: AppRec[] = d.applications || []
      const open = a.filter(x => !FINAL_STATUSES.includes(x.status)) // decided applications no longer count
      setCounts({ apps: open.length, review: open.filter(x => MGMT_STAGES.includes(normStage(x.stage))).length, attention: a.filter(x => x.status === "Review" || x.status === "Overdue").length })
    }).catch(() => {})
  }, [pathname, tick])
  useEffect(() => { setOpen(false); setMenu(false); setWho(false) }, [pathname])
  // heartbeat + who's online
  useEffect(() => {
    let stop = false
    const beat = () => { if (document.hidden) return; fetch("/api/presence", { method: "POST" }).then(r => r.ok ? r.json() : null).then(d => { if (!stop && d) setOnline(d.online || []) }).catch(() => {}) }
    beat(); const t = setInterval(beat, 20000)
    document.addEventListener("visibilitychange", beat)
    return () => { stop = true; clearInterval(t); document.removeEventListener("visibilitychange", beat) }
  }, [])
  // instant refresh: when anyone signs in/out the database pings the live channel (tick goes up) -> reload who's online right away
  useEffect(() => {
    let stop = false
    fetch("/api/presence").then(r => r.ok ? r.json() : null).then(d => { if (!stop && d) setOnline(d.online || []) }).catch(() => {})
    return () => { stop = true }
  }, [tick])
  // unread activity (other people's actions since this person last opened the activity log)
  useEffect(() => {
    try {
      if (pathname.startsWith("/workspace/activity")) { localStorage.setItem("sp_seen", String(Date.now())); setUnread(0); return }
      if (!localStorage.getItem("sp_seen")) localStorage.setItem("sp_seen", String(Date.now()))
    } catch {}
    fetch("/api/activity").then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return
      let seen = 0; try { seen = Number(localStorage.getItem("sp_seen") || 0) } catch {}
      setUnread((d.activity || []).filter((a: any) => a.user !== name && Date.parse(a.createdAt) > seen).length)
    }).catch(() => {})
  }, [pathname, tick, name])

  const link = (i: NavItem) => {
    const n = i.count === "apps" ? counts.apps : i.count === "review" ? counts.review : 0
    return <Link key={i.href + i.label} href={i.href} className={i === current ? "on" : ""} aria-current={i === current ? "page" : undefined}><i.icon size={20} /><span>{i.label}</span>{n > 0 && <span className="pt-badge">{n}</span>}</Link>
  }

  return (
    <div className="pt">
      <aside className={`pt-side ${open ? "open" : ""}`}>
        <SideArt />
        <Link href="/" className="pt-brand" aria-label="Spatial Planning home"><img src="/portal-logo.png" alt="City of Mutare Spatial Planning Department" /><strong>Spatial Planning</strong><small>City of Mutare</small></Link>
        <div className="pt-cap">MAIN NAVIGATION</div>
        <nav className="pt-nav" aria-label="Main navigation">{nav.main.map(link)}</nav>
        {nav.dept.length > 0 && <><div className="pt-cap">DEPARTMENT</div><nav className="pt-nav" aria-label="Department">{nav.dept.map(link)}</nav></>}
        <div className="pt-grow" />
        <div className="pt-help"><CircleHelp size={26} /><div><strong>Need a hand?</strong><small>Contact your administrator</small></div><ArrowRight size={16} /></div>
        <nav className="pt-nav pt-side-foot"><a href="/logout"><LogOut size={20} />Logout</a></nav>
      </aside>
      {open && <button className="pt-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}

      <div className="pt-main">
        <header className="pt-top">
          <div className="pt-top-l">
            <button className="pt-icon pt-menu" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={22} /></button>
            <div className="pt-crumb"><span>Spatial Planning</span><span>›</span><strong>{current?.label || String(title)}</strong></div>
          </div>
          <div className="pt-top-r">
            <span className={`pt-live ${live}`} role="status" title={live === "live" ? "Connected - changes appear instantly" : live === "connecting" ? "Connecting…" : live === "polling" ? "Instant updates unavailable - this page refreshes automatically every few seconds" : "No internet connection"}><i />{live === "live" ? "Live" : live === "connecting" ? "Connecting" : live === "polling" ? "Auto-refresh" : "Offline"}</span>
            <div className="pt-who">
              <button className="pt-icon" style={{ width: "auto", padding: "0 6px", gap: 6, display: "flex" }} aria-label={`${online.length} staff online`} aria-expanded={who} onClick={() => setWho(w => !w)}>
                <span className="pt-stack-av">{online.slice(0, 3).map(u => <span key={u.id} className="pt-avatar" title={u.name}>{initials(u.name)}</span>)}</span>
                <span className="pt-online-n">{online.length} online</span>
              </button>
              {who && <div className="pt-pop" role="dialog" aria-label="Staff online now"><div><strong>Online now</strong><small>{online.length} signed in</small></div>
                {online.map(u => <p key={u.id} className="pt-on-row"><span className="pt-avatar">{initials(u.name)}</span><span><strong>{u.name}</strong><small>{u.role}</small></span></p>)}
                {online.length === 0 && <small style={{ padding: "6px 10px", display: "block" }}>No one else is online.</small>}</div>}
            </div>
            <span className="pt-date"><CalendarDays size={19} /><span>{today}</span></span>
            <Link href="/applications" className="pt-icon" aria-label="Search applications"><Search size={20} /></Link>
            <Link href="/workspace/activity" className="pt-icon" aria-label={unread > 0 ? `${unread} new activity updates` : "Recent activity"}>{unread > 0 && <span className="pt-bell-n">{unread > 99 ? "99+" : unread}</span>}<Bell size={20} /></Link>
            <div className="pt-user">
              <button aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(m => !m)}><span className="pt-avatar">{initials(name)}</span><strong>{firstName(name)}</strong><ChevronDown size={16} /></button>
              {menu && <div className="pt-pop" role="menu"><div><strong>{name}</strong><small>{role}</small></div><a href="/logout" role="menuitem"><LogOut size={17} />Sign out</a></div>}
            </div>
          </div>
        </header>

        <header className={`pt-hero ${stats ? "tall" : ""}`}>
          <div className="pt-hero-in">
            <div><div className="pt-eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
            {actions && <div className="pt-acts">{actions}</div>}
          </div>
        </header>

        <div className={`pt-body ${stats ? "" : "pad"}`}>
          {stats && <StatCards items={stats} />}
          {notice && <div className="pt-notice" role="status"><CircleCheck size={18} /><span>{notice}</span>{onDismiss && <button aria-label="Dismiss" onClick={onDismiss}><X size={16} /></button>}</div>}
          {children}
        </div>
        <FootArt />
      </div>
    </div>
  )
}

/* small shared card heading */
export function CardHead({ icon: Icon, title, sub, right, count }: { icon?: LucideIcon; title: string; sub?: string; right?: ReactNode; count?: string }) {
  return (
    <div className="pt-ch">
      <div className="pt-ch-l">{Icon && <span className="pt-ch-ic"><Icon size={21} /></span>}<div><h2>{title}{count && <span className="pt-count">{count}</span>}</h2>{sub && <p>{sub}</p>}</div></div>
      {right}
    </div>
  )
}

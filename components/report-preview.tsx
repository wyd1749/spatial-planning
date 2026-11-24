"use client"

import { useEffect, useRef } from "react"
import { Download, FileText, X } from "lucide-react"

export type RPCell = string | { text: string; tone?: "yellow" | "orange" | "red" | "green" | "blue" | "grey" }
export type RPItem = { label: string; value: number; color?: string; warn?: boolean }
export type RPSummary = { title: string; kind: "stack" | "bars"; items: RPItem[] }

export const RP_COLORS = ["#2a7aa4", "#d9951b", "#2e9a5a", "#c0392b", "#8e6bbf", "#5b6b7c"]
const cellText = (c: RPCell) => (typeof c === "string" ? c : c.text)
const colLetter = (i: number) => String.fromCharCode(65 + i)

/** Count occurrences of each label, biggest first. */
export function tally(values: string[]): RPItem[] {
  const m = new Map<string, number>()
  values.forEach(v => m.set(v || "—", (m.get(v || "—") || 0) + 1))
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}
export const withColors = (items: RPItem[]) => items.map((i, n) => ({ ...i, color: i.color || RP_COLORS[n % RP_COLORS.length] }))

function Summary({ s }: { s: RPSummary }) {
  const total = s.items.reduce((n, i) => n + i.value, 0)
  const max = Math.max(1, ...s.items.map(i => i.value))
  return (
    <section className="rp-card">
      <h3>{s.title}</h3>
      {s.kind === "stack" ? <>
        <div className="rp-stack" role="img" aria-label={s.items.map(i => `${i.label} ${i.value}`).join(", ")}>
          {total === 0 ? <i style={{ width: "100%", background: "#e6ecf1" }} /> : s.items.filter(i => i.value > 0).map(i => <i key={i.label} style={{ width: `${(i.value / total) * 100}%`, background: i.color }} />)}
        </div>
        <div className="rp-legend">{s.items.map(i => <span key={i.label}><b style={{ background: i.color }} />{i.label} <strong>{i.value}</strong></span>)}</div>
      </> : (
        <div className="rp-bars">{s.items.map(i => (
          <div key={i.label}><span className={i.warn ? "warn" : ""} title={i.label}>{i.label}</span><span className="bar"><i style={{ width: `${(i.value / max) * 100}%`, background: i.warn ? "#c0392b" : "#2a7aa4" }} /></span><strong>{i.value}</strong></div>
        ))}{s.items.length === 0 && <small>No data</small>}</div>
      )}
    </section>
  )
}

export default function ReportPreview({ title = "Report preview", filename, columns, rows, summaries, onClose }: {
  title?: string; filename: string; columns: string[]; rows: RPCell[][]; summaries: RPSummary[]; onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", key)
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev }
  }, [onClose])

  function download() {
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`
    const csv = [columns.map(esc).join(","), ...rows.map(r => r.map(c => esc(cellText(c))).join(","))].join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="rp-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rp" role="dialog" aria-modal="true" aria-label={title}>
        <header className="rp-head">
          <span className="rp-ic"><FileText size={22} /></span>
          <div><h2>{title}</h2><p>{filename} · {rows.length} rows</p></div>
          <div className="rp-head-r">
            <button className="rp-dl" onClick={download}><Download size={17} />Download CSV</button>
            <button ref={closeRef} className="rp-x" aria-label="Close preview" onClick={onClose}><X size={20} /></button>
          </div>
        </header>
        <div className="rp-sum">{summaries.map(s => <Summary key={s.title} s={s} />)}</div>
        <div className="rp-sheet">
          <table>
            <thead>
              <tr className="rp-letters"><th />{columns.map((_, i) => <th key={i}>{colLetter(i)}</th>)}</tr>
              <tr className="rp-cols"><th className="rp-n">1</th>{columns.map(c => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  <th className="rp-n">{ri + 2}</th>
                  {r.map((c, ci) => typeof c === "string"
                    ? <td key={ci} className={ci === 0 ? "first" : ""}>{c}</td>
                    : <td key={ci} className={`tone ${c.tone || ""}`}>{c.text}</td>)}
                </tr>
              ))}
              {rows.length === 0 && <tr><th className="rp-n">2</th><td colSpan={columns.length} style={{ color: "#6b7b8c" }}>Nothing to show.</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="rp-foot"><span className="rp-tab">Sheet1</span><span>{rows.length} rows × {columns.length} columns</span></footer>
      </div>
    </div>
  )
}

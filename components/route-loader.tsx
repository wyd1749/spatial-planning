"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

const MIN_MS = 2000
const LOGO = "/city-of-mutare-coat.png"

/**
 * Full-screen loader: the City of Mutare crest inside a spinning ring.
 * Shows on first load and on every in-app navigation, and always stays up for at least 2 seconds.
 */
function Loader({ logo }: { logo: string }) {
  const pathname = usePathname()
  const search = useSearchParams()
  const key = `${pathname}?${search?.toString() ?? ""}`
  const [visible, setVisible] = useState(true) // true from the first server render, so there is no flash
  const [leaving, setLeaving] = useState(false)
  const shownAt = useRef(Date.now())
  const waiting = useRef(true) // true until the page for the current navigation has arrived
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = () => {
    clearTimeout(timer.current)
    shownAt.current = Date.now(); waiting.current = true
    setLeaving(false); setVisible(true)
  }
  const hideAfterMin = () => {
    clearTimeout(timer.current)
    const wait = Math.max(0, MIN_MS - (Date.now() - shownAt.current))
    timer.current = setTimeout(() => { setLeaving(true); timer.current = setTimeout(() => setVisible(false), 350) }, wait)
  }

  // New page has arrived (first load, or the route changed)
  useEffect(() => { waiting.current = false; hideAfterMin(); return () => clearTimeout(timer.current) }, [key])

  // Start the loader as soon as an internal link is clicked
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.("a") as HTMLAnchorElement | null
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin) return
      if (url.pathname === location.pathname && url.search === location.search) return // same page / hash jump
      show()
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  if (!visible) return null
  return (
    <div className={`rl-wrap ${leaving ? "rl-out" : ""}`} role="status" aria-live="polite" aria-label="Loading">
      <div className="rl-spin">
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="rl-track" cx="60" cy="60" r="54" /><circle className="rl-arc" cx="60" cy="60" r="54" /></svg>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="City of Mutare" className="rl-logo" />
      </div>
      <p className="rl-text">Loading…</p>
      <style>{`
        .rl-wrap{position:fixed;inset:0;z-index:9999;display:grid;place-content:center;justify-items:center;gap:18px;background:rgba(244,248,254,.97);backdrop-filter:blur(6px);transition:opacity .35s ease}
        .rl-wrap.rl-out{opacity:0;pointer-events:none}
        .rl-spin{position:relative;width:168px;height:168px;display:grid;place-items:center}
        .rl-spin svg{position:absolute;inset:0;width:100%;height:100%;animation:rl-rot 1.1s linear infinite}
        .rl-track{fill:none;stroke:#dbe7f5;stroke-width:5}
        .rl-arc{fill:none;stroke:#1478e8;stroke-width:5;stroke-linecap:round;stroke-dasharray:90 250}
        .rl-logo{width:104px;height:104px;object-fit:contain;animation:rl-pulse 1.6s ease-in-out infinite}
        .rl-text{margin:0;font:600 14px/1 system-ui,sans-serif;color:#4b628c;letter-spacing:.06em}
        @keyframes rl-rot{to{transform:rotate(360deg)}}
        @keyframes rl-pulse{50%{transform:scale(.93);opacity:.85}}
        @media (prefers-reduced-motion:reduce){.rl-spin svg,.rl-logo{animation-duration:3s}}
      `}</style>
    </div>
  )
}

// useSearchParams needs a Suspense boundary; this wrapper is all the layout has to render.
export default function RouteLoader({ logo = LOGO }: { logo?: string }) {
  return <Suspense fallback={null}><Loader logo={logo} /></Suspense>
}

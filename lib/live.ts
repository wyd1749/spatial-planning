"use client"

import { useSyncExternalStore } from "react"
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js"

/*
 * One shared Supabase Realtime connection for the whole app.
 * The database sends a tiny "change" signal (table name only, no data) whenever anything is saved.
 * Components re-fetch through the normal API routes when the tick number goes up.
 * A slow poll runs as a safety net, and a fast one if the live connection is down.
 */
// live = realtime connected | polling = internet OK but realtime not connected (page auto-refreshes) | offline = no internet
export type LiveStatus = "connecting" | "live" | "polling" | "offline"
type Rt = "connecting" | "live" | "failed"

let client: SupabaseClient | null = null
let channel: RealtimeChannel | null = null
let tick = 0
let rt: Rt = "connecting"
let status: LiveStatus = "connecting"
let timer: ReturnType<typeof setInterval> | null = null
let debounce: ReturnType<typeof setTimeout> | null = null
let beats = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())
const bump = () => { if (debounce) clearTimeout(debounce); debounce = setTimeout(() => { tick++; emit() }, 350) }
const compute = (): LiveStatus => (typeof navigator !== "undefined" && !navigator.onLine ? "offline" : rt === "live" ? "live" : rt === "failed" ? "polling" : "connecting")
const refresh = () => { const next = compute(); if (next !== status) { status = next; emit(); if (next === "live") bump() } }
const setRt = (r: Rt) => { rt = r; refresh() }
const onNet = () => { refresh(); if (navigator.onLine) bump() }
const onVisible = () => { if (!document.hidden) bump() }

function start() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && key) {
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    channel = client.channel("spatial-live")
      .on("broadcast", { event: "change" }, bump)
      .subscribe(s => setRt(s === "SUBSCRIBED" ? "live" : "failed"))
  } else { rt = "failed" }
  refresh()
  timer = setInterval(() => { if (document.hidden || status === "offline") return; if (status !== "live" || ++beats % 4 === 0) bump() }, 15000)
  window.addEventListener("online", onNet)
  window.addEventListener("offline", onNet)
  document.addEventListener("visibilitychange", onVisible)
}
function stop() {
  if (timer) clearInterval(timer)
  if (debounce) clearTimeout(debounce)
  window.removeEventListener("online", onNet)
  window.removeEventListener("offline", onNet)
  document.removeEventListener("visibilitychange", onVisible)
  if (client && channel) client.removeChannel(channel)
  client = null; channel = null; timer = null; rt = "connecting"; status = "connecting"
}
function subscribe(cb: () => void) {
  listeners.add(cb)
  if (listeners.size === 1) start()
  return () => { listeners.delete(cb); if (listeners.size === 0) stop() }
}

/** Number that goes up every time data changed anywhere. Put it in a useEffect dependency list to re-fetch. */
export const useLiveTick = () => useSyncExternalStore(subscribe, () => tick, () => 0)
export const useLiveStatus = () => useSyncExternalStore<LiveStatus>(subscribe, () => status, () => "connecting")

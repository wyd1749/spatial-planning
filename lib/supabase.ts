import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | null = null

// Server-side client using the service_role key. Created lazily so builds don't fail
// when env vars are only present at runtime.
export function db(): SupabaseClient {
  if (client) return client
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local")
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

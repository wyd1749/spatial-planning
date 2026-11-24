# Going live (realtime) - setup

1. Supabase > SQL Editor: run `sql/migration-003-realtime.sql` (once).
2. Supabase > Project Settings > API: copy the Project URL and the `anon` public key.
3. Vercel > Project > Settings > Environment Variables, add (Production + Preview):
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   (SESSION_SECRET, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY stay as they are. The service role key must NEVER start with NEXT_PUBLIC_.)
4. Supabase > Realtime > Settings: make sure "Allow public access" is ON (it is by default).
5. Redeploy on Vercel (NEXT_PUBLIC_ variables are baked in at build time).

Test: open the app in two browsers as two different users, save a note in one - the other updates in about a second.
The green "Live" pill in the top bar confirms the connection; "Offline" means pages fall back to refreshing every ~15 seconds.

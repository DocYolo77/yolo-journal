import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

// Lazily instantiated so that module import (e.g. during `next build` page
// data collection) never requires the env vars to be present — only an
// actual call at request time does.
export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) {
    return cachedClient
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase server configuration is missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY).'
    )
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return cachedClient
}
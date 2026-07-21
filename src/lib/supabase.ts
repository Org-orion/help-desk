import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const enabled = (import.meta.env.VITE_ENABLE_SUPABASE ?? '1') !== '0'

const isValidSupabaseUrl = (u: string | undefined) =>
  !!u && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(u)

export const supabase: SupabaseClient | undefined =
  enabled && isValidSupabaseUrl(url) && !!anonKey ? createClient(url!, anonKey!) : undefined

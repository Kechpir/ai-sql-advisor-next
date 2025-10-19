// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

// Берём stage-значения, если они заданы в окружении (Preview на Vercel),
// иначе — продовые. Так ты не запутаешься в именах.
const supabaseUrl =
  process.env.NEXT_PUBLIC_STAGE_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_STAGE_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase env is missing: set either NEXT_PUBLIC_STAGE_SUPABASE_URL/ANON_KEY (for stage) or NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (for prod).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

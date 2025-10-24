import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // берём только первое значение до запятой и тримим — иначе в Location попадёт ", "
  const rawProto = (req.headers['x-forwarded-proto'] as string) || (req.headers['x-forwarded-protocol'] as string) || 'https'
  const rawHost  = (req.headers['x-forwarded-host']  as string) || req.headers.host || ''

  const proto = rawProto.split(',')[0].trim()
  const host  = rawHost.split(',')[0].trim()

  if (!host) return res.status(400).json({ error: 'No host header' })

  const origin = `${proto}://${host}`
  const redirectTo = `${origin}/auth`

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  })

  if (error) return res.status(400).json({ error: error.message })

  // Жёсткий 302 c чистой строкой Location
  const url = String(data?.url || '')
  res.setHeader('Cache-Control', 'no-store')
  return res.redirect(302, url || '/auth')
}

cat > pages/api/google-login.ts <<'TS'
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1) Достаём origin корректно за прокси Vercel
  const proto =
    (req.headers['x-forwarded-proto'] as string) ||
    (req.headers['x-forwarded-protocol'] as string) ||
    'https'
  const host =
    (req.headers['x-forwarded-host'] as string) ||
    req.headers.host ||
    ''
  const origin = `${proto}://${host}`

  // 2) Куда вернуться после OAuth
  const redirectTo = `${origin}/auth`

  // 3) Клиент Supabase (stage env в Vercel)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // 4) Запрашиваем ссылку авторизации у Supabase
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })

  if (error) {
    return res.status(400).json({ error: error.message })
  }

  // 5) Жёсткий редирект на Google/Supabase (обязательно 302)
  if (data?.url) {
    res.setHeader('Cache-Control', 'no-store')
    return res.redirect(302, data.url)
  }
  return res.redirect(302, '/auth')
}
TS

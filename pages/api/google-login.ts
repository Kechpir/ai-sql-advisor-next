// pages/api/google-login.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1) Динамический origin (работает для stage/prod/localhost)
  const proto =
    (req.headers['x-forwarded-proto'] as string) ||
    (req.headers['x-forwarded-protocol'] as string) ||
    'https'
  const host =
    (req.headers['x-forwarded-host'] as string) ||
    req.headers.host ||
    'localhost:3000'
  const origin = `${proto}://${host}`

  // 2) Куда вернуться после OAuth
  const redirectTo = `${origin}/auth`

  // 3) Подключаемся к Supabase (как в остальном фронте)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // 4) Получаем ссылку на Google OAuth с корректным redirectTo
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })

  if (error) {
    return res.status(400).json({ error: error.message })
  }
  // 5) Редиректим пользователя на страницу Google
  return res.redirect(data.url)
}

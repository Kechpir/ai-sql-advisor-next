import type { NextApiRequest, NextApiResponse } from 'next'
import { securityMiddleware } from '@/lib/middleware'

// Тестовый endpoint - требует авторизацию
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Требуем авторизацию
  const { authorized, userId } = await securityMiddleware(req, res, {
    requireAuth: true,
    allowedMethods: ['GET', 'OPTIONS']
  });

  if (!authorized || !userId) {
    return; // Ответ уже отправлен middleware (401 Unauthorized)
  }

  try {
    const { supabase } = await import('@/lib/supabaseClient');
    const { data, error } = await supabase.from('profiles').select('*').limit(1)
    if (error) throw error
    res.status(200).json({ ok: true, rows: data?.length ?? 0 })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

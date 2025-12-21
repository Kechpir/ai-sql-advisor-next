import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from '@supabase/supabase-js';

// Тестовый endpoint для проверки Supabase ключей
// Использование: GET /api/verify-supabase-key

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Метод не поддерживается" });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim().replace(/\s+/g, '');
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');

    const results: any = {
      url: supabaseUrl || 'НЕ НАСТРОЕН',
      urlLength: supabaseUrl?.length || 0,
      hasServiceKey: !!serviceKey,
      serviceKeyLength: serviceKey?.length || 0,
      hasAnonKey: !!anonKey,
      anonKeyLength: anonKey?.length || 0,
      tests: {},
    };

    if (!supabaseUrl) {
      return res.status(500).json({ error: "NEXT_PUBLIC_SUPABASE_URL не настроен", results });
    }

    // Тест 1: Service Key
    if (serviceKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data, error } = await supabase.from('user_token_usage').select('id').limit(1);
        results.tests.serviceKey = {
          success: !error,
          error: error?.message || null,
          code: error?.code || null,
        };
      } catch (e: any) {
        results.tests.serviceKey = {
          success: false,
          error: e.message,
        };
      }
    }

    // Тест 2: Anon Key
    if (anonKey) {
      try {
        const supabase = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data, error } = await supabase.from('user_token_usage').select('id').limit(1);
        results.tests.anonKey = {
          success: !error,
          error: error?.message || null,
          code: error?.code || null,
        };
      } catch (e: any) {
        results.tests.anonKey = {
          success: false,
          error: e.message,
        };
      }
    }

    // Тест 3: Проверка формата ключей
    if (serviceKey) {
      const serviceKeyStart = serviceKey.substring(0, 20);
      const serviceKeyEnd = serviceKey.substring(serviceKey.length - 10);
      results.serviceKeyPreview = `${serviceKeyStart}...${serviceKeyEnd}`;
      results.serviceKeyStartsWith = serviceKey.substring(0, 10);
    }

    if (anonKey) {
      const anonKeyStart = anonKey.substring(0, 20);
      const anonKeyEnd = anonKey.substring(anonKey.length - 10);
      results.anonKeyPreview = `${anonKeyStart}...${anonKeyEnd}`;
      results.anonKeyStartsWith = anonKey.substring(0, 10);
    }

    return res.status(200).json(results);
  } catch (err: any) {
    return res.status(500).json({
      error: String(err?.message || "Ошибка проверки"),
      stack: err?.stack,
    });
  }
}


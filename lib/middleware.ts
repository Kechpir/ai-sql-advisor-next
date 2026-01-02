/**
 * Middleware для безопасности API endpoints
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from '@supabase/supabase-js';
import { checkAuth, getJWTFromRequest } from '@/lib/auth';

// Разрешенные origins для CORS
const ALLOWED_ORIGINS = [
  'https://ai-sql-advisor.vercel.app',
  'https://ai-sql-advisor-next-stage.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001'
];

/**
 * Устанавливает CORS заголовки
 */
export function setCorsHeaders(res: NextApiResponse, origin: string | undefined) {
  const originHeader = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  res.setHeader('Access-Control-Allow-Origin', originHeader);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 часа
}

/**
 * Обрабатывает preflight OPTIONS запросы
 */
export function handleCorsPreflight(req: NextApiRequest, res: NextApiResponse): boolean {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, req.headers.origin);
    res.status(200).end();
    return true; // Запрос обработан
  }
  return false; // Продолжить обработку
}

/**
 * Проверяет активную подписку пользователя
 * @returns { plan: string, active: boolean } или null если ошибка
 */
export async function checkSubscription(req: NextApiRequest): Promise<{ plan: string; active: boolean } | null> {
  const userId = checkAuth(req);
  if (!userId) {
    return null;
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');
    const serviceKey = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim().replace(/\s+/g, '');
    
    if (!supabaseUrl || (!anonKey && !serviceKey)) {
      console.warn('[checkSubscription] Supabase не настроен');
      return null;
    }

    const jwt = getJWTFromRequest(req);
    
    // Приоритет: используем anon key с JWT для работы с RLS (если есть JWT)
    // Это позволяет RLS автоматически фильтровать данные по user_id
    // Service key используем только если нет anon key или JWT
    const useAnonKey = jwt && anonKey;
    const supabaseKey = useAnonKey ? anonKey! : (serviceKey || anonKey!);
    
    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          // Если используем anon key, передаем JWT для работы с RLS
          // Если используем service key, JWT не нужен (обходит RLS)
          ...(jwt && useAnonKey ? { headers: { 'Authorization': `Bearer ${jwt}` } } : {})
        }
      }
    );

    // Получаем подписку пользователя
    // Используем правильные поля из миграции: status (text) и current_period_end (timestamp)
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .eq('user_id', userId)
      .single();

    if (error) {
      // Если подписки нет, возвращаем free план
      if (error.code === 'PGRST116') {
        return { plan: 'free', active: true };
      }
      
      // Если ошибка с API ключом, логируем и возвращаем free план (не блокируем доступ)
      if (error.message?.includes('Invalid API key') || error.message?.includes('API key')) {
        console.warn('[checkSubscription] Проблема с API ключом, используем free план по умолчанию:', error.message);
        return { plan: 'free', active: true };
      }
      
      // Для других ошибок логируем, но не блокируем доступ
      console.warn('[checkSubscription] Ошибка получения подписки, используем free план по умолчанию:', error.message || error);
      return { plan: 'free', active: true };
    }

    if (!subscription) {
      return { plan: 'free', active: true };
    }

    // Проверяем, не истекла ли подписка
    // status должен быть 'active' и current_period_end должен быть в будущем
    const isExpired = subscription.current_period_end && new Date(subscription.current_period_end) < new Date();
    const active = subscription.status === 'active' && !isExpired;

    return {
      plan: subscription.plan || 'free',
      active
    };
  } catch (error: any) {
    // В случае любой ошибки возвращаем free план (не блокируем доступ)
    console.warn('[checkSubscription] Исключение при проверке подписки, используем free план по умолчанию:', error?.message || error);
    return { plan: 'free', active: true };
  }
}

/**
 * Проверяет, имеет ли пользователь доступ к endpoint на основе плана
 * @param requiredPlan - минимальный требуемый план ('free' | 'light' | 'pro')
 */
export async function requireSubscription(
  req: NextApiRequest,
  res: NextApiResponse,
  requiredPlan: 'free' | 'light' | 'pro' = 'free'
): Promise<boolean> {
  const subscription = await checkSubscription(req);
  
  // Если проверка не удалась, используем free план (не блокируем доступ)
  if (!subscription) {
    console.warn('[requireSubscription] Не удалось получить подписку, используем free план');
    // Не блокируем доступ, просто используем free план
    const freeSubscription = { plan: 'free' as const, active: true };
    const planHierarchy = { free: 0, light: 1, pro: 2 };
    const userPlanLevel = planHierarchy[freeSubscription.plan];
    const requiredPlanLevel = planHierarchy[requiredPlan];
    
    if (userPlanLevel < requiredPlanLevel) {
      res.status(403).json({ 
        error: `Требуется план ${requiredPlan} или выше`,
        current_plan: 'free',
        required_plan: requiredPlan,
        subscription_required: true
      });
      return false;
    }
    return true;
  }

  if (!subscription.active) {
    res.status(403).json({ 
      error: 'Подписка неактивна или истекла',
      subscription_required: true
    });
    return false;
  }

  const planHierarchy = { free: 0, light: 1, pro: 2 };
  const userPlanLevel = planHierarchy[subscription.plan as keyof typeof planHierarchy] ?? 0;
  const requiredPlanLevel = planHierarchy[requiredPlan];

  if (userPlanLevel < requiredPlanLevel) {
    res.status(403).json({ 
      error: `Требуется план ${requiredPlan} или выше`,
      current_plan: subscription.plan,
      required_plan: requiredPlan,
      subscription_required: true
    });
    return false;
  }

  return true;
}

/**
 * Комплексный middleware для безопасности
 * Проверяет CORS, авторизацию и подписку
 */
export async function securityMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  options: {
    requireAuth?: boolean;
    requireSubscription?: 'free' | 'light' | 'pro';
    allowedMethods?: string[];
  } = {}
): Promise<{ authorized: boolean; userId: string | null; subscription: { plan: string; active: boolean } | null }> {
  const {
    requireAuth = true,
    requireSubscription: requiredPlan,
    allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  } = options;

  // Обработка CORS preflight
  if (handleCorsPreflight(req, res)) {
    return { authorized: false, userId: null, subscription: null };
  }

  // Установка CORS заголовков
  setCorsHeaders(res, req.headers.origin);

  // Проверка метода
  if (!allowedMethods.includes(req.method || '')) {
    res.status(405).json({ error: `Метод ${req.method} не разрешен` });
    return { authorized: false, userId: null, subscription: null };
  }

  // Проверка авторизации
  if (requireAuth) {
    const userId = checkAuth(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return { authorized: false, userId: null, subscription: null };
    }

    // Проверка подписки
    if (requiredPlan) {
      const hasAccess = await requireSubscription(req, res, requiredPlan);
      if (!hasAccess) {
        return { authorized: false, userId, subscription: null };
      }
    }

    const subscription = await checkSubscription(req);
    return { authorized: true, userId, subscription };
  }

  return { authorized: true, userId: null, subscription: null };
}


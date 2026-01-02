import type { NextApiRequest, NextApiResponse } from 'next';
import { securityMiddleware } from '@/lib/middleware';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Обрабатываем CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // КРИТИЧНО: Требуем авторизацию - неавторизованные пользователи не могут использовать сервис
  const { authorized, userId } = await securityMiddleware(req, res, {
    requireAuth: true, // Обязательная авторизация
    allowedMethods: ['POST', 'OPTIONS']
  });

  if (!authorized || !userId) {
    return; // Ответ уже отправлен middleware (401 Unauthorized)
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  const { question, context = 'assistant', contextualHelp } = req.body;

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Не передан вопрос' });
  }

  console.log('[assistant-help] Получен запрос:', { 
    question: question.substring(0, 50), 
    context,
    userId: userId.substring(0, 8) + '...'
  });

  // Используем Supabase Edge Function для обработки запросов (решает проблему с кодировкой UTF-8)
  const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Вызываем Supabase Edge Function
  try {
    const jwt = req.headers.authorization?.replace(/^Bearer /i, '') || null;
    
    if (!jwt) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    const response = await fetch(`${BASE}/assistant-help`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({
        question,
        context,
        contextualHelp
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      console.error('[assistant-help] Edge Function error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData
      });
      
      // Если токен истек или невалиден, возвращаем понятное сообщение
      if (response.status === 401 || errorData.message?.includes('JWT') || errorData.message?.includes('expired')) {
        throw new Error('Токен авторизации истек. Пожалуйста, обновите страницу и войдите заново.');
      }
      
      throw new Error(`Edge Function error: ${response.status} - ${errorData.message || errorText}`);
    }

    const data = await response.json();
    const { answer, tokensUsed } = data;
    
    console.log('[assistant-help] Получен ответ от Edge Function:', {
      answerLength: answer?.length || 0,
      tokensUsed
    });
    
    return res.status(200).json({ answer: answer || 'Извините, не удалось получить ответ. Попробуйте позже.' });
  } catch (error: any) {
    console.error('[assistant-help] Ошибка:', error);
    return res.status(200).json({
      answer: `Извините, возникла техническая проблема: ${error?.message || 'Неизвестная ошибка'}. Попробуйте обновить страницу и попробовать снова.`
    });
  }
}

import React, { useState, useEffect } from 'react';

interface TokenUsage {
  tokens_used: number;
  subscription_tokens?: number;
  purchased_tokens?: number;
  total_available?: number;
  remaining?: number;
  period_start: string | null;
  period_end: string | null;
}

export default function TokenCounter() {
  const [tokensRemaining, setTokensRemaining] = useState<number | null>(null);
  const [totalAvailable, setTotalAvailable] = useState<number | null>(null);
  const [purchasedTokens, setPurchasedTokens] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTokenUsage = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    }
    
    try {
      const jwt = localStorage.getItem('jwt');
      if (!jwt) {
        setTokensRemaining(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Добавляем timestamp для предотвращения кэширования
      const response = await fetch(`/api/get-token-usage?t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Пользователь не авторизован
          setTokensRemaining(null);
          setLoading(false);
          return;
        }
        // Для других ошибок показываем 0, но логируем ошибку
        const errorText = await response.text().catch(() => '');
        console.warn('Ошибка получения токенов:', response.status, errorText);
        setTokensRemaining(0); // Показываем 0 вместо null
        setError(null); // Не показываем ошибку пользователю
        setLoading(false);
        return;
      }

      const data: TokenUsage = await response.json();
      const totalAvail = data.total_available || data.subscription_tokens || 0;
      const tokensUsed = data.tokens_used || 0;
      // Вычисляем оставшиеся токены
      const remaining = data.remaining !== undefined 
        ? data.remaining 
        : Math.max(0, totalAvail - tokensUsed);
      
      setTokensRemaining(remaining);
      setTotalAvailable(totalAvail);
      setPurchasedTokens(data.purchased_tokens || 0);
      setError(null);
      console.log('[TokenCounter] Обновлено: осталось', remaining, 'токенов из', totalAvail);
    } catch (err: any) {
      console.error('Ошибка получения токенов:', err);
      // Показываем 0 вместо ошибки, чтобы счетчик всегда был виден
      setTokensRemaining(0);
      setError(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTokenUsage();

    // Обновляем счетчик каждые 30 секунд
    const interval = setInterval(fetchTokenUsage, 30000);

    // Слушаем события генерации SQL для обновления счетчика
    const handleSqlGenerated = () => {
      // Обновляем несколько раз для надежности
      fetchTokenUsage(true); // Сразу с индикацией
      setTimeout(() => fetchTokenUsage(true), 1000); // Через 1 сек
      setTimeout(() => fetchTokenUsage(true), 2000); // Через 2 сек (на случай задержки БД)
    };

    window.addEventListener('sql-generated', handleSqlGenerated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sql-generated', handleSqlGenerated);
    };
  }, []);

  // Если пользователь не авторизован, не показываем счетчик
  if (loading) {
    return null; // Показываем только во время загрузки
  }
  
  // Если tokensRemaining === null, значит пользователь не авторизован
  if (tokensRemaining === null) {
    return null;
  }

  // Форматирование числа с разделителями тысяч и сокращениями
  const formatTokens = (num: number) => {
    if (num >= 1_000_000) {
      // Миллионы: 1.5M
      return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    } else if (num >= 1_000) {
      // Тысячи: 1.5K
      return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    // Меньше тысячи: просто число
    return num.toLocaleString('ru-RU');
  };

  return (
    <div
      style={{
        background: 'rgba(20, 20, 30, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '0.6rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <span
        style={{
          color: 'var(--text-dim)',
          fontSize: '0.85rem',
          fontWeight: 500,
        }}
      >
        🪙 Осталось токенов:
      </span>
      <span
        style={{
          color: 'var(--accent)',
          fontSize: '1rem',
          fontWeight: 600,
          fontFamily: 'monospace',
          opacity: refreshing ? 0.6 : 1,
          transition: 'opacity 0.2s',
        }}
        title={
          totalAvailable !== null 
            ? `Осталось: ${tokensRemaining.toLocaleString('ru-RU')} из ${totalAvailable.toLocaleString('ru-RU')}${purchasedTokens > 0 ? ` (дополнительно куплено: ${purchasedTokens.toLocaleString('ru-RU')})` : ''}`
            : `Осталось: ${tokensRemaining.toLocaleString('ru-RU')} токенов`
        }
      >
        {refreshing ? '⏳' : ''} {formatTokens(tokensRemaining)}
      </span>
      {error && (
        <span
          style={{
            color: '#ff6b6b',
            fontSize: '0.75rem',
            marginLeft: '0.5rem',
          }}
          title={error}
        >
          ⚠️
        </span>
      )}
    </div>
  );
}


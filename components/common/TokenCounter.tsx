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
  // Инициализируем состояние как null для серверного рендеринга
  // Значения из localStorage загрузим в useEffect после монтирования
  const [tokensRemaining, setTokensRemaining] = useState<number | null>(null);
  const [totalAvailable, setTotalAvailable] = useState<number | null>(null);
  const [purchasedTokens, setPurchasedTokens] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  const fetchTokenUsage = async (showRefreshing = false) => {
    // НЕ устанавливаем loading=true при обновлении, чтобы компонент не исчезал
    if (showRefreshing) {
      setRefreshing(true);
    }
    
    try {
      const jwt = localStorage.getItem('jwt');
      if (!jwt) {
        setTokensRemaining(null);
        // Устанавливаем loading только при первой загрузке
        if (!tokensRemaining && tokensRemaining !== 0) {
          setLoading(false);
        }
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
          // Устанавливаем loading только при первой загрузке
          if (!tokensRemaining && tokensRemaining !== 0) {
            setLoading(false);
          }
          setRefreshing(false);
          return;
        }
        // Для других ошибок сохраняем предыдущее значение, но логируем ошибку
        const errorText = await response.text().catch(() => '');
        console.warn('Ошибка получения токенов:', response.status, errorText);
        // НЕ меняем tokensRemaining, чтобы компонент не исчезал
        // setTokensRemaining(0); // Убрано - сохраняем предыдущее значение
        setError(null); // Не показываем ошибку пользователю
        // Устанавливаем loading только при первой загрузке
        if (!tokensRemaining && tokensRemaining !== 0) {
          setLoading(false);
        }
        setRefreshing(false);
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
      setLoading(false); // Устанавливаем loading=false после успешной загрузки
      
      // Сохраняем в localStorage для быстрой загрузки при F5
      try {
        localStorage.setItem('tokenCounter_lastValue', remaining.toString());
        localStorage.setItem('tokenCounter_totalAvailable', totalAvail.toString());
      } catch (e) {
        // Игнорируем ошибки localStorage (может быть отключен)
      }
      
      console.log('[TokenCounter] Обновлено: осталось', remaining, 'токенов из', totalAvail);
    } catch (err: any) {
      console.error('Ошибка получения токенов:', err);
      // НЕ меняем tokensRemaining при ошибке, чтобы компонент не исчезал
      // setTokensRemaining(0); // Убрано - сохраняем предыдущее значение
      setError(null);
      // Устанавливаем loading только при первой загрузке
      if (!tokensRemaining && tokensRemaining !== 0) {
        setLoading(false);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Загружаем значения из localStorage после монтирования (только на клиенте)
  useEffect(() => {
    setMounted(true);
    
    // Загружаем кэшированные значения из localStorage
    try {
      const storedTokens = localStorage.getItem('tokenCounter_lastValue');
      const storedTotal = localStorage.getItem('tokenCounter_totalAvailable');
      
      if (storedTokens) {
        setTokensRemaining(parseInt(storedTokens, 10));
      }
      if (storedTotal) {
        setTotalAvailable(parseInt(storedTotal, 10));
      }
    } catch {
      // Игнорируем ошибки localStorage
    }
  }, []);

  useEffect(() => {
    // Запускаем загрузку только после монтирования
    if (!mounted) return;
    
    fetchTokenUsage();

    // Обновляем счетчик каждые 30 секунд
    const interval = setInterval(fetchTokenUsage, 30000);

    // Слушаем события генерации SQL для обновления счетчика
    const handleSqlGenerated = () => {
      // Обновляем с небольшой задержкой, чтобы БД успела обновиться
      setTimeout(() => fetchTokenUsage(true), 500); // Через 0.5 сек
      setTimeout(() => fetchTokenUsage(true), 1500); // Через 1.5 сек (на случай задержки БД)
    };

    window.addEventListener('sql-generated', handleSqlGenerated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sql-generated', handleSqlGenerated);
    };
  }, [mounted]);

  // Не рендерим на сервере (до монтирования)
  if (!mounted) {
    return null;
  }
  
  // Если tokensRemaining === null, значит пользователь не авторизован или еще загружается
  // Показываем компонент только если есть данные (не null) или если не загружается
  // Это предотвращает исчезновение при Fast Refresh
  if (tokensRemaining === null && loading) {
    return null; // Скрываем только если нет данных И идет загрузка
  }
  
  // Если загрузка завершена, но данных нет - значит не авторизован
  if (tokensRemaining === null && !loading) {
    return null;
  }
  
  // Если есть данные, показываем компонент даже если loading=true (Fast Refresh)
  // Используем предыдущее значение токенов во время обновления
  const displayTokens = tokensRemaining !== null ? tokensRemaining : 0;

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
            ? `Осталось: ${displayTokens.toLocaleString('ru-RU')} из ${totalAvailable.toLocaleString('ru-RU')}${purchasedTokens > 0 ? ` (дополнительно куплено: ${purchasedTokens.toLocaleString('ru-RU')})` : ''}`
            : `Осталось: ${displayTokens.toLocaleString('ru-RU')} токенов`
        }
      >
        {refreshing ? '⏳' : ''} {formatTokens(displayTokens)}
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


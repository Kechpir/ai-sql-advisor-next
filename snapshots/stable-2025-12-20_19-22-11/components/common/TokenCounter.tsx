import React, { useState, useEffect } from 'react';

interface TokenUsage {
  tokens_used: number;
  period_start: string | null;
  period_end: string | null;
}

export default function TokenCounter() {
  const [tokensUsed, setTokensUsed] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTokenUsage = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    }
    
    try {
      const jwt = localStorage.getItem('jwt');
      if (!jwt) {
        setTokensUsed(null);
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
          setTokensUsed(null);
          setLoading(false);
          return;
        }
        // Для других ошибок показываем 0, но логируем ошибку
        const errorText = await response.text().catch(() => '');
        console.warn('Ошибка получения токенов:', response.status, errorText);
        setTokensUsed(0); // Показываем 0 вместо null
        setError(null); // Не показываем ошибку пользователю
        setLoading(false);
        return;
      }

      const data: TokenUsage = await response.json();
      const newTokens = data.tokens_used || 0;
      setTokensUsed(newTokens);
      setError(null);
      console.log('[TokenCounter] Обновлено:', newTokens, 'токенов');
    } catch (err: any) {
      console.error('Ошибка получения токенов:', err);
      // Показываем 0 вместо ошибки, чтобы счетчик всегда был виден
      setTokensUsed(0);
      setError(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const testTokenUpdate = async () => {
    setTesting(true);
    try {
      const jwt = localStorage.getItem('jwt');
      if (!jwt) {
        alert('Не авторизован! Войдите в систему.');
        return;
      }

      const response = await fetch('/api/test-token-update?tokens=1000', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
        },
      });

      const data = await response.json();
      if (response.ok) {
        console.log('✅ Тест успешен:', data);
        alert(`✅ Токены добавлены!\nБыло: ${data.previous}\nДобавлено: ${data.added}\nСтало: ${data.newTotal}`);
        // Принудительно обновляем счетчик несколько раз (на случай задержки БД)
        fetchTokenUsage(true); // Сразу с индикацией
        setTimeout(() => fetchTokenUsage(true), 500); // Через 0.5 сек
        setTimeout(() => fetchTokenUsage(true), 1500); // Через 1.5 сек (на случай задержки БД)
      } else {
        console.error('❌ Ошибка теста:', data);
        alert(`❌ Ошибка: ${data.error}\n\nПроверьте консоль для деталей.`);
      }
    } catch (err: any) {
      console.error('Ошибка теста:', err);
      alert(`❌ Ошибка: ${err.message}`);
    } finally {
      setTesting(false);
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
  
  // Если tokensUsed === null, значит пользователь не авторизован
  if (tokensUsed === null) {
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
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        background: 'rgba(20, 20, 30, 0.95)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '0.6rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        zIndex: 1000,
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
        🪙 Токенов использовано:
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
        title={`Точно: ${tokensUsed.toLocaleString('ru-RU')} токенов`}
      >
        {refreshing ? '⏳' : ''} {formatTokens(tokensUsed)}
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
      {/* Кнопка для тестирования (только в dev режиме) */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={testTokenUpdate}
          disabled={testing}
          style={{
            marginLeft: '0.5rem',
            padding: '0.2rem 0.5rem',
            fontSize: '0.7rem',
            background: testing ? 'var(--border)' : 'rgba(34, 211, 238, 0.2)',
            border: '1px solid var(--accent)',
            borderRadius: '4px',
            color: 'var(--accent)',
            cursor: testing ? 'not-allowed' : 'pointer',
            opacity: testing ? 0.5 : 1,
          }}
          title="Тест: добавить 1000 токенов"
        >
          {testing ? '⏳' : '🧪'}
        </button>
      )}
    </div>
  );
}


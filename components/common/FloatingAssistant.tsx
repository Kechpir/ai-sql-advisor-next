import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Props {
  context?: 'assistant' | 'builder'; // Контекст страницы
}

export default function FloatingAssistant({ context = 'assistant' }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: context === 'assistant' 
        ? '👋 Привет! Я помощник по SQL. Могу помочь:\n• Сформулировать запрос на естественном языке\n• Объяснить, как работает генератор SQL\n• Подсказать примеры запросов\n\nСпроси меня: "что ты умеешь?" или "как сформулировать запрос?"'
        : '👋 Привет! Я помощник по SQL конструктору. Могу помочь:\n• Объяснить функции конструктора\n• Подсказать, как использовать JOIN, GROUP BY и другие функции\n• Помочь правильно настроить запрос\n\nСпроси меня: "что ты умеешь?" или "как использовать JOIN?"',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const getContextualHelp = (): string => {
    if (context === 'assistant') {
      return `Ты помощник на странице AI SQL генератора. Пользователь может:
- Вводить запросы на естественном языке
- Загружать схемы БД
- Генерировать SQL запросы с помощью AI
- Выполнять запросы и просматривать результаты

Помогай пользователю правильно формулировать запросы для генерации SQL.`;
    } else {
      return `Ты помощник на странице SQL конструктора. Пользователь может:
- Использовать визуальный конструктор SQL
- Строить запросы через интерфейс (SELECT, WHERE, JOIN, GROUP BY, HAVING, CTE, Window Functions)
- Выполнять запросы и просматривать результаты

Помогай пользователю понять, как использовать функции конструктора.`;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const jwt = localStorage.getItem('jwt');
      if (!jwt) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '❌ Для использования помощника необходима авторизация. Пожалуйста, войдите в систему.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        setLoading(false);
        return;
      }

      const response = await fetch('/api/assistant-help', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({
          question: userMessage.content,
          context: context,
          contextualHelp: getContextualHelp()
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Токен истек - очищаем его и просим переавторизоваться
          localStorage.removeItem('jwt');
          throw new Error('Токен авторизации истек. Пожалуйста, обновите страницу и войдите заново.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ошибка получения ответа');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer || 'Извините, не удалось получить ответ.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      let errorContent = '❌ Ошибка: ' + (error.message || 'Не удалось получить ответ. Попробуйте позже.');
      
      // Если токен истек, даем более понятное сообщение
      if (error.message?.includes('истек') || error.message?.includes('expired')) {
        errorContent = '🔒 Ваша сессия истекла. Пожалуйста, обновите страницу и войдите в систему заново.';
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = context === 'assistant' 
    ? [
        'Что ты умеешь?',
        'Как сформулировать запрос?',
        'Примеры запросов',
        'Как загрузить схему БД?'
      ]
    : [
        'Что ты умеешь?',
        'Как использовать JOIN?',
        'Что такое GROUP BY?',
        'Как использовать CTE?'
      ];

  if (!isOpen) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
        }}
      >
        <div
          onClick={() => setIsOpen(true)}
          style={{
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '16px',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#ffffff',
            whiteSpace: 'nowrap',
            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)';
          }}
          title="Открыть помощника"
        >
          <span style={{ fontSize: '18px' }}>🤖</span>
          <span>Помощник по сайту</span>
        </div>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
        }}
      >
        <div
          onClick={() => setIsMinimized(false)}
          style={{
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '16px',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#ffffff',
            whiteSpace: 'nowrap',
            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)';
          }}
          title="Развернуть помощника"
        >
          <span style={{ fontSize: '18px' }}>🤖</span>
          <span>Помощник по сайту</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '380px',
        maxHeight: '600px',
        background: 'rgba(20, 20, 30, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px 16px 0 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>💬</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '16px' }}>
            SQL Помощник
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsMinimized(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              color: '#fff',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Свернуть"
          >
            ➖
          </button>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              color: '#fff',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Закрыть"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxHeight: '400px',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                background: msg.role === 'user' 
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'rgba(255, 255, 255, 0.05)',
                padding: '12px 16px',
                borderRadius: '12px',
                maxWidth: '85%',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: '#e5e7eb',
                fontSize: '14px',
                lineHeight: '1.5',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: '4px', padding: '12px' }}>
            <span style={{ fontSize: '20px' }}>⏳</span>
            <span style={{ color: '#9ca3af', fontSize: '14px' }}>Думаю...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      {messages.length <= 1 && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => setInput(q)}
              style={{
                background: 'rgba(102, 126, 234, 0.2)',
                border: '1px solid rgba(102, 126, 234, 0.3)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                color: '#a78bfa',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)';
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          gap: '8px',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Задайте вопрос..."
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#e5e7eb',
            fontSize: '14px',
            outline: 'none',
          }}
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          style={{
            background: input.trim() && !loading
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            color: '#fff',
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 600,
            transition: 'all 0.2s',
          }}
        >
          {loading ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  );
}


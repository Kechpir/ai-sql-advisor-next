import { useState, useEffect } from "react";
import Link from "next/link";
import Head from "next/head";

export default function TarifyPage() {
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);

  useEffect(() => {
    // Проверяем текущий план пользователя (если авторизован)
    const jwt = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    if (jwt) {
      // TODO: Загрузить текущий план через API
      // fetch('/api/get-subscription')...
    }
  }, []);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      icon: '🆓',
      price: 'Бесплатно',
      period: '3 дня',
      description: 'Идеально для знакомства с платформой',
      features: [
        { text: '100,000 токенов', highlight: true },
        { text: '~77 SQL запросов', highlight: false },
        { text: '20 открытий таблиц', highlight: false },
        { text: '20 скачиваний файлов', highlight: false },
        { text: 'До 50 таблиц в схеме', highlight: false },
        { text: 'Файлы до 500KB', highlight: false },
        { text: 'Весь функционал', highlight: false },
      ],
      limitations: [
        'Токены сгорают через 3 дня',
        'Ограниченное количество открытий',
      ],
      cta: 'Начать бесплатно',
      ctaLink: '/auth',
      popular: false,
    },
    {
      id: 'light',
      name: 'Light',
      icon: '💡',
      price: '$15',
      period: 'в месяц',
      description: 'Для регулярных пользователей',
      features: [
        { text: '1,300,000 токенов (1.3M)', highlight: true },
        { text: '~1,000 SQL запросов', highlight: false },
        { text: '50 открытий таблиц/мес', highlight: false },
        { text: '50 скачиваний/мес', highlight: false },
        { text: 'До 100 таблиц в схеме', highlight: false },
        { text: 'Файлы до 2MB', highlight: false },
        { text: 'Покупка токенов: $2 за 1.5M или $3.5 за 2.5M', highlight: true },
        { text: 'Весь функционал', highlight: false },
      ],
      limitations: [
        'Ограниченное количество открытий',
        'Ограниченный размер файлов',
      ],
      cta: 'Выбрать Light',
      ctaLink: '/auth',
      popular: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      icon: '⚡',
      price: '$30',
      period: 'в месяц',
      description: 'Для профессионалов и активных пользователей',
      features: [
        { text: '2,600,000 токенов (2.6M)', highlight: true },
        { text: '~2,000 SQL запросов', highlight: false },
        { text: 'Безлимитные открытия таблиц', highlight: true },
        { text: 'Безлимитные скачивания', highlight: true },
        { text: 'До 200 таблиц в схеме', highlight: false },
        { text: 'Файлы до 10MB', highlight: false },
        { text: 'Покупка токенов: $2 за 1.5M или $3.5 за 2.5M', highlight: false },
        { text: 'Приоритетная поддержка', highlight: true },
      ],
      limitations: [],
      cta: 'Выбрать Pro',
      ctaLink: '/auth',
      popular: false,
    },
  ];

  return (
    <>
      <Head>
        <title>Тарифы - AI SQL Advisor</title>
        <meta name="description" content="Выберите подходящий тариф для работы с AI SQL Advisor" />
      </Head>

      <div style={{
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle at top left, #0b1220 0%, #060914 100%)',
        padding: '2rem 1rem',
        color: '#e5e7eb',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <Link href="/" style={{ 
              display: 'inline-block', 
              marginBottom: '1rem',
              color: '#60a5fa',
              textDecoration: 'none',
              fontSize: '0.9rem',
            }}>
              ← Назад на главную
            </Link>
            <h1 style={{
              fontSize: '3rem',
              fontWeight: 700,
              margin: '0.5rem 0',
              background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Тарифы
            </h1>
            <p style={{
              fontSize: '1.2rem',
              color: '#9ca3af',
              marginTop: '0.5rem',
            }}>
              Выберите план, который подходит именно вам
            </p>
          </div>

          {/* Plans Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, 320px)',
            gap: '2rem',
            marginBottom: '3rem',
            justifyContent: 'center',
            justifyItems: 'center',
            width: '100%',
          }}>
            {plans.map((plan) => (
              <div
                key={plan.id}
                style={{
                  background: plan.popular
                    ? 'linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, rgba(167, 139, 250, 0.1) 100%)'
                    : 'rgba(20, 20, 30, 0.8)',
                  border: plan.popular
                    ? '2px solid rgba(96, 165, 250, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '2rem',
                  position: 'relative',
                  backdropFilter: 'blur(10px)',
                  boxShadow: plan.popular
                    ? '0 8px 32px rgba(96, 165, 250, 0.2)'
                    : '0 4px 16px rgba(0, 0, 0, 0.3)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  width: '100%',
                  maxWidth: '380px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = plan.popular
                    ? '0 12px 40px rgba(96, 165, 250, 0.3)'
                    : '0 8px 24px rgba(0, 0, 0, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = plan.popular
                    ? '0 8px 32px rgba(96, 165, 250, 0.2)'
                    : '0 4px 16px rgba(0, 0, 0, 0.3)';
                }}
              >
                {plan.popular && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
                    color: '#fff',
                    padding: '0.25rem 1rem',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}>
                    Популярный
                  </div>
                )}

                {/* Plan Header */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                    {plan.icon}
                  </div>
                  <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    margin: '0.5rem 0',
                  }}>
                    {plan.name}
                  </h2>
                  <p style={{
                    color: '#9ca3af',
                    fontSize: '0.9rem',
                    marginBottom: '1rem',
                  }}>
                    {plan.description}
                  </p>
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}>
                    <span style={{
                      fontSize: '2.5rem',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span style={{ color: '#9ca3af', fontSize: '1rem' }}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                </div>

                {/* Features */}
                <div style={{ marginBottom: '2rem' }}>
                  <ul style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                  }}>
                    {plan.features.map((feature, idx) => (
                      <li
                        key={idx}
                        style={{
                          padding: '0.75rem 0',
                          borderBottom: idx < plan.features.length - 1
                            ? '1px solid rgba(255, 255, 255, 0.05)'
                            : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                        }}
                      >
                        <span style={{
                          color: feature.highlight ? '#60a5fa' : '#9ca3af',
                          fontSize: '1.2rem',
                        }}>
                          {feature.highlight ? '✨' : '✓'}
                        </span>
                        <span style={{
                          color: feature.highlight ? '#fff' : '#d1d5db',
                          fontWeight: feature.highlight ? 600 : 400,
                        }}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Limitations */}
                {plan.limitations.length > 0 && (
                  <div style={{
                    marginBottom: '2rem',
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }}>
                    <p style={{
                      fontSize: '0.85rem',
                      color: '#fca5a5',
                      margin: 0,
                      fontWeight: 500,
                    }}>
                      ⚠️ {plan.limitations.join(', ')}
                    </p>
                  </div>
                )}

                {/* CTA Button */}
                <Link
                  href={plan.ctaLink}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.875rem 1.5rem',
                    background: plan.popular
                      ? 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)'
                      : 'rgba(96, 165, 250, 0.1)',
                    border: plan.popular
                      ? 'none'
                      : '1px solid rgba(96, 165, 250, 0.3)',
                    borderRadius: '8px',
                    color: plan.popular ? '#fff' : '#60a5fa',
                    textAlign: 'center',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '1rem',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!plan.popular) {
                      e.currentTarget.style.background = 'rgba(96, 165, 250, 0.2)';
                      e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!plan.popular) {
                      e.currentTarget.style.background = 'rgba(96, 165, 250, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.3)';
                    }
                  }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Comparison Table */}
          <div style={{
            background: 'rgba(20, 20, 30, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '2rem',
            marginBottom: '3rem',
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '1.5rem',
              textAlign: 'center',
            }}>
              Сравнение тарифов
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}>
                <thead>
                  <tr style={{
                    borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
                  }}>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      color: '#9ca3af',
                      fontWeight: 600,
                    }}>
                      Параметр
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'center',
                      color: '#9ca3af',
                      fontWeight: 600,
                    }}>
                      🆓 Free
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'center',
                      color: '#9ca3af',
                      fontWeight: 600,
                    }}>
                      💡 Light
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'center',
                      color: '#9ca3af',
                      fontWeight: 600,
                    }}>
                      ⚡ Pro
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { param: 'Стоимость', free: 'Бесплатно', light: '$15/мес', pro: '$30/мес' },
                    { param: 'Лимит токенов', free: '100K', light: '1.3M', pro: '2.6M' },
                    { param: 'Срок действия', free: '3 дня', light: '1 месяц', pro: '1 месяц' },
                    { param: 'Примерно запросов', free: '~77', light: '~1,000', pro: '~2,000' },
                    { param: 'Открытие таблиц', free: '20/3 дня', light: '50/мес', pro: 'Безлимитно' },
                    { param: 'Скачивание файлов', free: '20/3 дня', light: '50/мес', pro: 'Безлимитно' },
                    { param: 'Максимум таблиц в схеме', free: '50', light: '100', pro: '200' },
                    { param: 'Размер файлов', free: 'До 500KB', light: 'До 2MB', pro: 'До 10MB' },
                    { param: 'Покупка токенов', free: '❌', light: '✅', pro: '✅' },
                  ].map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <td style={{
                        padding: '1rem',
                        color: '#d1d5db',
                        fontWeight: 500,
                      }}>
                        {row.param}
                      </td>
                      <td style={{
                        padding: '1rem',
                        textAlign: 'center',
                        color: '#9ca3af',
                      }}>
                        {row.free}
                      </td>
                      <td style={{
                        padding: '1rem',
                        textAlign: 'center',
                        color: '#9ca3af',
                      }}>
                        {row.light}
                      </td>
                      <td style={{
                        padding: '1rem',
                        textAlign: 'center',
                        color: '#60a5fa',
                        fontWeight: 600,
                      }}>
                        {row.pro}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQ Section */}
          <div style={{
            background: 'rgba(20, 20, 30, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '2rem',
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '1.5rem',
              textAlign: 'center',
            }}>
              Часто задаваемые вопросы
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {[
                {
                  q: 'Что такое токены?',
                  a: 'Токены — это единица измерения использования AI. Каждый SQL запрос потребляет определенное количество токенов (в среднем ~1,300 токенов на запрос).',
                },
                {
                  q: 'Можно ли изменить тариф?',
                  a: 'Да, вы можете изменить тариф в любой момент. При переходе на более высокий тариф, оставшиеся токены сохраняются.',
                },
                {
                  q: 'Что происходит с токенами при истечении периода?',
                  a: 'Для Free плана токены сгорают через 3 дня. Для Light и Pro планов токены сбрасываются при продлении подписки (ежемесячно).',
                },
                {
                  q: 'Можно ли купить дополнительные токены?',
                  a: 'Да, для Light и Pro планов доступна покупка дополнительных токенов: $2 за 1.5M токенов (пакет "small") или $3.5 за 2.5M токенов (пакет "large"). Дополнительно купленные токены переносятся на следующий месяц и активируются только после продления подписки.',
                },
              ].map((faq, idx) => (
                <div key={idx}>
                  <h3 style={{
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                    color: '#60a5fa',
                  }}>
                    {faq.q}
                  </h3>
                  <p style={{
                    color: '#9ca3af',
                    lineHeight: '1.6',
                    margin: 0,
                  }}>
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


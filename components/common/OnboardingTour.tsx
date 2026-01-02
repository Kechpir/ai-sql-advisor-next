import { useState, useEffect, useCallback } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';

interface OnboardingTourProps {
  steps: Step[];
  run: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
}

export default function OnboardingTour({ steps, run, onComplete, onSkip }: OnboardingTourProps) {
  const [isRunning, setIsRunning] = useState(run);

  useEffect(() => {
    // При изменении run всегда обновляем состояние, даже если туториал уже был запущен
    setIsRunning(run);
  }, [run]);

  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, type } = data;

    if (type === STATUS.FINISHED || type === STATUS.SKIPPED) {
      setIsRunning(false);
      if (onComplete) {
        onComplete();
      }
    }

    if (type === STATUS.SKIPPED && onSkip) {
      onSkip();
    }
  }, [onComplete, onSkip]);

  if (steps.length === 0) {
    return null;
  }

  return (
    <Joyride
      key={isRunning ? 'running' : 'stopped'} // Добавляем key для принудительного пересоздания
      steps={steps}
      run={isRunning}
      continuous
      showProgress
      showSkipButton
      disableOverlayClose
      disableScrolling={false}
      spotlightClicks
      scrollToFirstStep
      spotlightPadding={20}
      floaterProps={{
        disableAnimation: false,
        placement: 'auto',
        disableFlip: false,
        styles: {
          floater: {
            filter: 'none',
            zIndex: 10001,
            pointerEvents: 'none', // Тултип не блокирует клики
          },
          arrow: {
            display: 'none', // Убираем стрелку
          },
        },
        options: {
          offset: 20,
          flip: true,
          shift: true,
          preventOverflow: {
            boundariesElement: 'viewport',
            padding: 30,
          },
        },
      }}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#22d3ee',
          zIndex: 10000,
        },
        tooltip: {
          backgroundColor: '#1e293b',
          color: '#e5e7eb',
          borderRadius: '10px',
          padding: '16px',
          border: '1px solid rgba(34, 211, 238, 0.3)',
          fontSize: '11.2px',
          maxWidth: '320px',
          position: 'fixed',
          pointerEvents: 'auto', // Кнопки в тултипе кликабельны
        },
        tooltipContainer: {
          textAlign: 'left',
          position: 'relative',
        },
        tooltipTitle: {
          color: '#22d3ee',
          fontSize: '14.4px',
          fontWeight: 600,
          marginBottom: '8px',
        },
        tooltipContent: {
          padding: '8px 0',
          lineHeight: '1.6',
          fontSize: '11.2px',
        },
        buttonNext: {
          backgroundColor: '#22d3ee',
          color: '#0f172a',
          borderRadius: '8px',
          padding: '10px 20px',
          fontSize: '14px',
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
        },
        buttonBack: {
          color: '#9ca3af',
          marginRight: '10px',
          fontSize: '14px',
        },
        buttonSkip: {
          color: '#9ca3af',
          fontSize: '14px',
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        },
        spotlight: {
          borderRadius: '12px',
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4), 0 0 50px rgba(34, 211, 238, 1), 0 0 100px rgba(34, 211, 238, 0.6), inset 0 0 40px rgba(34, 211, 238, 0.5)',
          border: '4px solid rgba(34, 211, 238, 1)',
          animation: 'pulse 2s ease-in-out infinite',
          zIndex: 9999,
        },
      }}
      locale={{
        back: 'Назад',
        close: 'Закрыть',
        last: 'Завершить',
        next: 'Далее',
        skip: 'Пропустить обучение',
      }}
    />
  );
}

// Хелпер для получения шагов туториала для главной страницы
export function getMainPageSteps(): Step[] {
  return [
    {
      target: '[data-tour="connection-string"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>1. Connection String (опционально)</h3>
          <p>Вы можете вставить полную строку подключения сюда - система автоматически определит тип БД и заполнит все поля ниже.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            💡 <strong>Пример:</strong> postgresql://user:password@host:5432/database<br/>
            Или заполните поля вручную ниже ⬇️
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="connection-name"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>2. Имя подключения</h3>
          <p>Дайте любое удобное имя вашему подключению. Это поможет вам быстро найти его в списке сохраненных подключений.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            💡 <strong>Пример:</strong> "Моя рабочая БД", "Supabase Production", "Тестовая база"
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      offset: 15,
    },
    {
      target: '[data-tour="connection-type"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>3. Тип базы данных</h3>
          <p>Выберите тип вашей SQL базы данных: PostgreSQL, MySQL, SQLite, MSSQL, Oracle, CockroachDB или ClickHouse.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            🔧 Система автоматически подставит стандартный порт для выбранного типа.
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      offset: 15,
    },
    {
      target: '[data-tour="connection-host"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>4. Хост</h3>
          <p>Введите адрес сервера базы данных. Это может быть доменное имя или IP-адрес.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            💡 <strong>Примеры:</strong> db.example.com, 192.168.1.100, ep-xxx.supabase.co
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      offset: 15,
    },
    {
      target: '[data-tour="connection-port"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>5. Порт</h3>
          <p>Введите порт подключения. Обычно это 5432 для PostgreSQL, 3306 для MySQL, 1433 для MSSQL.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            🔧 Порт автоматически подставляется при выборе типа БД, но вы можете изменить его.
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      offset: 15,
    },
    {
      target: '[data-tour="connection-database"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>6. База данных</h3>
          <p>Введите название базы данных, к которой вы хотите подключиться.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            💡 <strong>Примеры:</strong> postgres, myapp_db, production
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      offset: 15,
    },
    {
      target: '[data-tour="connection-user"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>7. Пользователь</h3>
          <p>Введите имя пользователя для подключения к базе данных.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            💡 <strong>Примеры:</strong> postgres, admin, myuser
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      offset: 15,
    },
    {
      target: '[data-tour="connection-password"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>8. Пароль</h3>
          <p>Введите пароль для подключения. Нажмите на иконку глаза 👁️, чтобы показать/скрыть пароль.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            🔒 Пароль хранится в зашифрованном виде и никогда не сохраняется в браузере.
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      offset: 15,
    },
    {
      target: '[data-tour="connection-save"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>9. Сохранить подключение</h3>
          <p>Нажмите "💾 Сохранить", чтобы сохранить подключение для будущего использования. Вы сможете быстро выбрать его из списка.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            💾 Сохраненные подключения доступны в выпадающем списке сверху.
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      offset: 15,
    },
    {
      target: '[data-tour="load-schema"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>10. Подключиться</h3>
          <p>После заполнения всех полей нажмите "🔌 Подключить", чтобы установить соединение и загрузить схему базы данных.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            📊 После подключения AI узнает структуру вашей БД и сможет генерировать более точные SQL запросы.
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      offset: 15,
    },
    {
      target: '[data-tour="query-input"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>11. Ввод запроса</h3>
          <p>Введите ваш запрос на естественном языке. Например: "покажи всех сотрудников старше 30 лет".</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            💬 Вы можете загрузить файл (.sql, .csv, .xlsx) для дополнительного контекста.
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="generate-button"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>12. Генерация SQL</h3>
          <p>Нажмите "Сгенерировать", чтобы AI создал SQL запрос на основе вашего запроса и схемы базы данных.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            ⚡ Генерация занимает несколько секунд и расходует токены из вашего тарифа.
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      offset: 15,
    },
    {
      target: '[data-tour="show-table"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>13. Просмотр результатов</h3>
          <p>Нажмите "Показать таблицу", чтобы выполнить SQL запрос и увидеть результаты в удобной таблице.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            📊 Вы можете экспортировать данные, фильтровать и сортировать результаты.
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      offset: 15,
    },
    {
      target: '[data-tour="constructor-link"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>14. SQL Конструктор</h3>
          <p>Перейдите в SQL Конструктор для визуального создания сложных запросов с JOIN, GROUP BY, CTE и другими функциями.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            🛠️ Конструктор идеален для тех, кто предпочитает визуальный интерфейс вместо текстовых запросов.
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
    },
  ];
}

// Хелпер для получения шагов туториала для страницы конструктора
export function getConstructorSteps(): Step[] {
  return [
    {
      target: '[data-tour="constructor-connection"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>1. Подключение в конструкторе</h3>
          <p>Выберите подключение к базе данных для работы в конструкторе.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            🔌 Подключение должно быть сохранено заранее.
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      offset: 10,
    },
    {
      target: '[data-tour="constructor-base"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>2. Базовые операции</h3>
          <p>В панели "Base" вы можете выбрать таблицы, колонки, добавить условия WHERE, сортировку и лимиты.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            📝 Это основа для простых SELECT запросов.
          </p>
        </div>
      ),
      placement: 'top',
      disableBeacon: true,
      offset: 10,
    },
    {
      target: '[data-tour="constructor-advanced"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>3. Продвинутые операции</h3>
          <p>В панели "Advanced" доступны JOIN, GROUP BY, HAVING для более сложных запросов.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            🔗 Используйте JOIN для объединения данных из нескольких таблиц.
          </p>
        </div>
      ),
      placement: 'top',
      disableBeacon: true,
      offset: 10,
    },
    {
      target: '[data-tour="constructor-expert"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>4. Экспертные функции</h3>
          <p>В панели "Expert" вы найдете CTE (WITH), Window Functions, JSON операции и другие продвинутые функции.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            🚀 Для опытных пользователей SQL.
          </p>
        </div>
      ),
      placement: 'top',
      disableBeacon: true,
      offset: 10,
    },
    {
      target: '[data-tour="constructor-execute"]',
      content: (
        <div>
          <h3 style={{ marginTop: 0, color: '#22d3ee' }}>5. Выполнение запроса</h3>
          <p>После построения запроса нажмите "Выполнить", чтобы увидеть результаты.</p>
          <p style={{ marginBottom: 0, fontSize: '12px', opacity: 0.8 }}>
            ✅ Результаты отображаются в таблице ниже.
          </p>
        </div>
      ),
      placement: 'left',
      disableBeacon: true,
      offset: 10,
    },
  ];
}


/**
 * Утилита для автоматической нормализации connection strings для разных провайдеров
 * Решает проблемы с различными форматами подключения к SQL базам данных
 */

export interface NormalizedConnection {
  connectionString: string;
  provider: string;
  method: 'direct' | 'pooler' | 'transaction_pooler';
  notes?: string[];
}

/**
 * Определяет провайдера БД по connection string
 */
function detectProvider(connectionString: string): string {
  const connStr = connectionString.toLowerCase();
  
  if (connStr.includes('supabase.co') || connStr.includes('pooler.supabase.com')) {
    return 'supabase';
  }
  if (connStr.includes('neon.tech') || connStr.includes('neon')) {
    return 'neon';
  }
  if (connStr.includes('amazonaws.com') || connStr.includes('rds.amazonaws.com')) {
    return 'aws-rds';
  }
  if (connStr.includes('azure.com') || connStr.includes('database.windows.net')) {
    return 'azure';
  }
  if (connStr.includes('cloud.google.com') || connStr.includes('gcp')) {
    return 'gcp';
  }
  if (connStr.includes('planetscale.com')) {
    return 'planetscale';
  }
  if (connStr.includes('railway.app')) {
    return 'railway';
  }
  if (connStr.includes('render.com')) {
    return 'render';
  }
  
  return 'generic';
}

/**
 * Нормализует connection string для Supabase
 */
function normalizeSupabase(connectionString: string): NormalizedConnection {
  try {
    const url = new URL(connectionString);
    const hostname = url.hostname;
    const port = url.port || '5432';
    const user = url.username;
    const password = url.password;
    const database = url.pathname.replace('/', '') || 'postgres';
    
    const notes: string[] = [];
    
    // Проверяем, используется ли старый формат (db.*.supabase.co)
    if (hostname.includes('db.') && hostname.includes('.supabase.co') && !hostname.includes('pooler')) {
      notes.push('Обнаружен старый формат Supabase (Direct connection)');
      notes.push('Рекомендуется использовать Transaction pooler для serverless');
      
      // Пробуем определить регион из project ref
      const projectRefMatch = hostname.match(/db\.([^.]+)\.supabase\.co/);
      if (projectRefMatch) {
        const projectRef = projectRefMatch[1];
        
        // Пробуем разные регионы (чаще всего us-east-1)
        const regions = ['us-east-1', 'us-west-1', 'eu-west-1', 'ap-southeast-1'];
        
        for (const region of regions) {
          const poolerHost = `aws-0-${region}.pooler.supabase.com`;
          const poolerUser = user.includes('.') ? user : `postgres.${projectRef}`;
          
          return {
            connectionString: `postgresql://${poolerUser}:${password}@${poolerHost}:6543/${database}?pgbouncer=true&pool_mode=transaction`,
            provider: 'supabase',
            method: 'transaction_pooler',
            notes: [
              'Автоматически исправлен на Transaction pooler',
              `Используется регион: ${region}`,
              'Если не работает, попробуйте другой регион из Dashboard'
            ]
          };
        }
      }
    }
    
    // Если уже используется pooler, проверяем формат пользователя
    if (hostname.includes('pooler.supabase.com')) {
      // Проверяем, правильный ли формат пользователя
      if (!user.includes('.')) {
        // Нужно добавить project ref к пользователю
        const projectRefMatch = hostname.match(/aws-\d+-(.+?)\.pooler/);
        if (projectRefMatch) {
          // Пробуем извлечь project ref из старого хоста или используем общий формат
          const projectRef = url.searchParams.get('project_ref') || 'zaheofzxbfqabdxdmjtz';
          const correctedUser = `postgres.${projectRef}`;
          
          return {
            connectionString: `postgresql://${correctedUser}:${password}@${hostname}:${port}/${database}?pgbouncer=true&pool_mode=transaction`,
            provider: 'supabase',
            method: 'transaction_pooler',
            notes: ['Исправлен формат пользователя для Transaction pooler']
          };
        }
      }
      
      // Если все правильно, просто добавляем pool_mode если его нет
      if (port === '6543' && !url.searchParams.has('pool_mode')) {
        url.searchParams.set('pool_mode', 'transaction');
        return {
          connectionString: url.toString(),
          provider: 'supabase',
          method: 'transaction_pooler',
          notes: ['Добавлен pool_mode=transaction для оптимальной работы']
        };
      }
    }
    
    // Если ничего не подошло, возвращаем как есть
    return {
      connectionString,
      provider: 'supabase',
      method: port === '6543' ? 'transaction_pooler' : 'direct',
      notes: notes.length > 0 ? notes : undefined
    };
  } catch (error) {
    return {
      connectionString,
      provider: 'supabase',
      method: 'direct',
      notes: ['Не удалось нормализовать connection string']
    };
  }
}

/**
 * Нормализует connection string для Neon
 */
function normalizeNeon(connectionString: string): NormalizedConnection {
  try {
    const url = new URL(connectionString);
    
    // Neon обычно использует connection pooling автоматически
    // Но можно добавить параметры для оптимизации
    if (!url.searchParams.has('sslmode')) {
      url.searchParams.set('sslmode', 'require');
    }
    
    return {
      connectionString: url.toString(),
      provider: 'neon',
      method: 'pooler',
      notes: ['Neon использует автоматический connection pooling']
    };
  } catch {
    return {
      connectionString,
      provider: 'neon',
      method: 'direct',
    };
  }
}

/**
 * Главная функция нормализации connection string
 */
export function normalizeConnectionString(connectionString: string): NormalizedConnection {
  const provider = detectProvider(connectionString);
  
  switch (provider) {
    case 'supabase':
      return normalizeSupabase(connectionString);
    case 'neon':
      return normalizeNeon(connectionString);
    case 'aws-rds':
    case 'azure':
    case 'gcp':
      // Для других провайдеров пока возвращаем как есть
      return {
        connectionString,
        provider,
        method: 'direct',
        notes: [`Провайдер ${provider} - используйте connection string из документации провайдера`]
      };
    default:
      return {
        connectionString,
        provider: 'generic',
        method: 'direct',
      };
  }
}

/**
 * Пробует несколько вариантов connection string для Supabase
 * Возвращает массив вариантов для попытки подключения
 */
export function getSupabaseConnectionVariants(originalConnectionString: string): string[] {
  const variants: string[] = [];
  
  try {
    const url = new URL(originalConnectionString);
    const hostname = url.hostname;
    const user = url.username;
    const password = url.password;
    const database = url.pathname.replace('/', '') || 'postgres';
    
    // Извлекаем project ref
    let projectRef = 'zaheofzxbfqabdxdmjtz'; // default
    const projectRefMatch = hostname.match(/db\.([^.]+)\.supabase\.co/);
    if (projectRefMatch) {
      projectRef = projectRefMatch[1];
    } else if (user.includes('.')) {
      projectRef = user.split('.')[1];
    }
    
    // Вариант 1: Transaction pooler (рекомендуемый для serverless)
    const regions = ['us-east-1', 'us-west-1', 'eu-west-1', 'ap-southeast-1'];
    for (const region of regions) {
      const poolerHost = `aws-0-${region}.pooler.supabase.com`;
      const poolerUser = `postgres.${projectRef}`;
      variants.push(`postgresql://${poolerUser}:${password}@${poolerHost}:6543/${database}?pgbouncer=true&pool_mode=transaction`);
    }
    
    // Вариант 2: Session pooler (альтернатива)
    for (const region of regions) {
      const poolerHost = `aws-0-${region}.pooler.supabase.com`;
      const poolerUser = `postgres.${projectRef}`;
      variants.push(`postgresql://${poolerUser}:${password}@${poolerHost}:6543/${database}?pgbouncer=true&pool_mode=session`);
    }
    
    // Вариант 3: Direct connection (может не работать извне)
    if (hostname.includes('db.')) {
      variants.push(`postgresql://${user}:${password}@${hostname}:5432/${database}?sslmode=require`);
    }
    
  } catch (error) {
    // Если не удалось распарсить, возвращаем оригинал
    variants.push(originalConnectionString);
  }
  
  return variants;
}


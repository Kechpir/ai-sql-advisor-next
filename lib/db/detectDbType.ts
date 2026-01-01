/**
 * Утилита для автоматического определения типа базы данных по connection string
 */

export interface DbTypeInfo {
  type: string;
  displayName: string;
  defaultPort: string;
  connectionStringPrefix: string[];
  driver: string;
}

export const SUPPORTED_DB_TYPES: Record<string, DbTypeInfo> = {
  postgresql: {
    type: 'postgres',
    displayName: 'PostgreSQL',
    defaultPort: '5432',
    connectionStringPrefix: ['postgresql://', 'postgres://', 'pgsql://'],
    driver: 'pg',
  },
  mysql: {
    type: 'mysql',
    displayName: 'MySQL',
    defaultPort: '3306',
    connectionStringPrefix: ['mysql://', 'mysql2://'],
    driver: 'mysql2',
  },
  mariadb: {
    type: 'mariadb',
    displayName: 'MariaDB',
    defaultPort: '3306',
    connectionStringPrefix: ['mariadb://', 'mariadb://'],
    driver: 'mysql2', // MariaDB совместим с MySQL драйвером
  },
  sqlite: {
    type: 'sqlite',
    displayName: 'SQLite',
    defaultPort: '',
    connectionStringPrefix: ['sqlite://', 'sqlite3://', 'file:'],
    driver: 'sqlite3',
  },
  mssql: {
    type: 'mssql',
    displayName: 'Microsoft SQL Server',
    defaultPort: '1433',
    connectionStringPrefix: ['mssql://', 'sqlserver://', 'jdbc:sqlserver://'],
    driver: 'mssql',
  },
  oracle: {
    type: 'oracle',
    displayName: 'Oracle Database',
    defaultPort: '1521',
    connectionStringPrefix: ['oracle://', 'oracledb://', 'jdbc:oracle:'],
    driver: 'oracledb',
  },
  cockroachdb: {
    type: 'cockroachdb',
    displayName: 'CockroachDB',
    defaultPort: '26257',
    connectionStringPrefix: ['cockroachdb://', 'cockroach://', 'crdb://'],
    driver: 'pg', // CockroachDB совместим с PostgreSQL драйвером
  },
  clickhouse: {
    type: 'clickhouse',
    displayName: 'ClickHouse',
    defaultPort: '8123',
    connectionStringPrefix: ['clickhouse://', 'ch://'],
    driver: 'clickhouse',
  },
  mongodb: {
    type: 'mongodb',
    displayName: 'MongoDB',
    defaultPort: '27017',
    connectionStringPrefix: ['mongodb://', 'mongodb+srv://'],
    driver: 'mongodb',
  },
  redis: {
    type: 'redis',
    displayName: 'Redis',
    defaultPort: '6379',
    connectionStringPrefix: ['redis://', 'rediss://'],
    driver: 'redis',
  },
};

/**
 * Автоматически определяет тип базы данных по connection string
 */
export function detectDbType(connectionString: string): DbTypeInfo | null {
  if (!connectionString || typeof connectionString !== 'string') {
    return null;
  }

  const connStr = connectionString.trim().toLowerCase();

  // Проверяем каждый тип БД
  for (const [key, dbInfo] of Object.entries(SUPPORTED_DB_TYPES)) {
    for (const prefix of dbInfo.connectionStringPrefix) {
      if (connStr.startsWith(prefix)) {
        return dbInfo;
      }
    }
  }

  // Специальные проверки для известных хостов
  if (connStr.includes('supabase.co') || connStr.includes('neon.tech')) {
    return SUPPORTED_DB_TYPES.postgresql;
  }

  if (connStr.includes('azure.com') && connStr.includes('database.windows.net')) {
    return SUPPORTED_DB_TYPES.mssql;
  }

  if (connStr.includes('amazonaws.com') && connStr.includes('rds')) {
    // AWS RDS может быть разных типов, но по умолчанию PostgreSQL
    if (connStr.includes('mysql')) {
      return SUPPORTED_DB_TYPES.mysql;
    }
    return SUPPORTED_DB_TYPES.postgresql;
  }

  // Если не удалось определить, возвращаем null
  return null;
}

/**
 * Получает информацию о типе БД по названию
 */
export function getDbTypeInfo(typeName: string): DbTypeInfo | null {
  const normalized = typeName.toLowerCase().trim();
  
  // Прямое совпадение
  if (SUPPORTED_DB_TYPES[normalized]) {
    return SUPPORTED_DB_TYPES[normalized];
  }

  // Поиск по типу
  for (const dbInfo of Object.values(SUPPORTED_DB_TYPES)) {
    if (dbInfo.type === normalized || dbInfo.displayName.toLowerCase() === normalized) {
      return dbInfo;
    }
  }

  return null;
}

/**
 * Форматирует connection string для указанного типа БД
 */
export function formatConnectionString(
  type: string,
  host: string,
  port: string,
  database: string,
  user: string,
  password: string,
  options?: Record<string, string>
): string {
  const dbInfo = getDbTypeInfo(type);
  if (!dbInfo) {
    throw new Error(`Неподдерживаемый тип БД: ${type}`);
  }

  const passwordEncoded = password ? `:${encodeURIComponent(password)}` : '';
  const portValue = port || dbInfo.defaultPort;
  
  // Формируем базовую строку
  let connectionString = '';
  const prefix = dbInfo.connectionStringPrefix[0];

  switch (dbInfo.type) {
    case 'postgres':
    case 'cockroachdb':
      // Для Supabase: pgbouncer=true только если порт 6543, иначе sslmode=require
      // Учитываем переданные options (могут переопределить)
      let sslParam = 'sslmode=require';
      if (host.includes('supabase.co')) {
        if (portValue === '6543') {
          sslParam = 'pgbouncer=true';
        } else {
          sslParam = 'sslmode=require';
        }
      }
      // Если переданы options, используем их вместо автоматического определения
      if (options && Object.keys(options).length > 0) {
        const params = new URLSearchParams(options);
        sslParam = params.toString();
      }
      connectionString = `postgresql://${user}${passwordEncoded}@${host}:${portValue}/${database}?${sslParam}`;
      break;
    
    case 'mysql':
    case 'mariadb':
      connectionString = `mysql://${user}${passwordEncoded}@${host}:${portValue}/${database}`;
      break;
    
    case 'sqlite':
      connectionString = `file:${database}`;
      break;
    
    case 'mssql':
      connectionString = `mssql://${user}${passwordEncoded}@${host}:${portValue}/${database}`;
      break;
    
    case 'oracle':
      connectionString = `oracle://${user}${passwordEncoded}@${host}:${portValue}/${database}`;
      break;
    
    case 'clickhouse':
      connectionString = `clickhouse://${user}${passwordEncoded}@${host}:${portValue}/${database}`;
      break;
    
    case 'mongodb':
      connectionString = `mongodb://${user}${passwordEncoded}@${host}:${portValue}/${database}`;
      break;
    
    case 'redis':
      connectionString = `redis://${passwordEncoded ? passwordEncoded.substring(1) + '@' : ''}${host}:${portValue}`;
      break;
    
    default:
      connectionString = `${prefix}${user}${passwordEncoded}@${host}:${portValue}/${database}`;
  }

  // Для PostgreSQL опции уже добавлены в switch, для остальных добавляем здесь
  if (dbInfo.type !== 'postgres' && dbInfo.type !== 'cockroachdb') {
    if (options && Object.keys(options).length > 0) {
      const params = new URLSearchParams(options);
      connectionString += (connectionString.includes('?') ? '&' : '?') + params.toString();
    }
  }

  return connectionString;
}

/**
 * Парсит connection string и извлекает компоненты
 */
export function parseConnectionString(connectionString: string): {
  type: string | null;
  host: string | null;
  port: string | null;
  database: string | null;
  user: string | null;
  password: string | null;
} {
  const dbInfo = detectDbType(connectionString);
  
  try {
    // Для SQLite
    if (connectionString.startsWith('file:')) {
      return {
        type: dbInfo?.type || 'sqlite',
        host: null,
        port: null,
        database: connectionString.replace(/^file:/, ''),
        user: null,
        password: null,
      };
    }

    // Для остальных типов используем URL парсинг
    const url = new URL(connectionString);
    
    return {
      type: dbInfo?.type || null,
      host: url.hostname,
      port: url.port || dbInfo?.defaultPort || null,
      database: url.pathname.replace(/^\//, '') || null,
      user: url.username || null,
      password: url.password || null,
    };
  } catch (error) {
    return {
      type: dbInfo?.type || null,
      host: null,
      port: null,
      database: null,
      user: null,
      password: null,
    };
  }
}


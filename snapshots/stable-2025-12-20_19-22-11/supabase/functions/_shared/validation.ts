// Утилиты для валидации входных данных
// supabase/functions/_shared/validation.ts

export function validateSchemaName(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  // Только буквы, цифры, дефисы, подчеркивания
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return false;
  if (name.length > 100) return false;
  if (name.includes("..") || name.includes("/")) return false;
  return true;
}

export function validateDbUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "db_url is required" };
  }
  
  // Только PostgreSQL
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    return { valid: false, error: "Only PostgreSQL connections are supported" };
  }
  
  // Запретить localhost/127.0.0.1 (SSRF защита)
  if (url.includes("localhost") || url.includes("127.0.0.1") || url.includes("0.0.0.0")) {
    return { valid: false, error: "Localhost connections are not allowed" };
  }
  
  // Запретить внутренние сети (SSRF защита)
  if (url.includes("10.") || url.includes("192.168.") || url.includes("172.16.")) {
    return { valid: false, error: "Private network connections are not allowed" };
  }
  
  return { valid: true };
}

export function validateSQL(sql: string): { valid: boolean; error?: string } {
  if (!sql || typeof sql !== "string") {
    return { valid: false, error: "SQL query is required" };
  }
  
  // Проверка на опасные операции
  const dangerous = /(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC|EXECUTE)/i;
  if (dangerous.test(sql)) {
    return { valid: false, error: "Only SELECT queries are allowed" };
  }
  
  // Проверка на системные таблицы
  const systemTables = /(pg_|information_schema|sys\.|mysql\.)/i;
  if (systemTables.test(sql)) {
    return { valid: false, error: "System tables are not allowed" };
  }
  
  // Проверка на множественные запросы
  const queries = sql.split(";").filter((s) => s.trim());
  if (queries.length > 1) {
    return { valid: false, error: "Only single query is allowed" };
  }
  
  return { valid: true };
}

export function validateRequestSize(
  nl?: string,
  schemaText?: string
): { valid: boolean; error?: string } {
  const MAX_NL_LENGTH = 5000; // символов
  const MAX_SCHEMA_SIZE = 100 * 1024; // 100KB
  
  if (nl && nl.length > MAX_NL_LENGTH) {
    return { valid: false, error: `Request too long (max ${MAX_NL_LENGTH} chars)` };
  }
  
  if (schemaText && schemaText.length > MAX_SCHEMA_SIZE) {
    return { valid: false, error: `Schema too large (max ${MAX_SCHEMA_SIZE} bytes)` };
  }
  
  return { valid: true };
}

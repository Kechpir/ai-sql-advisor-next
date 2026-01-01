import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import SimpleDbConnect from "@/components/connections/SimpleDbConnect";
import FileUpload from "@/components/common/FileUpload";
import CompactFileUpload from "@/components/common/CompactFileUpload";
import FrequentQueriesDropdown from "@/components/common/FrequentQueriesDropdown";
import DataTableModal from "@/components/tables/DataTableModal";
import TableTabsBar from "@/components/tables/TableTabsBar";
import TokenCounter from "@/components/common/TokenCounter";
import LimitModal from "@/components/common/LimitModal";
import { generateSql, saveSchema, logAction, reviewSql } from "@/lib/api";

/* -------------------- CONSTANTS -------------------- */
const DANGER_RE =
  /\b(DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|DELETE|UPDATE|INSERT|MERGE)\b/i;

/* -------------------- HELPERS -------------------- */
function annotate(sql: string) {
  const up = sql.toUpperCase();
  const notes: string[] = [];
  if (up.includes("SELECT")) notes.push("-- SELECT: какие колонки выводим и зачем");
  if (up.includes("FROM")) notes.push("-- FROM: источник данных — таблица или представление");
  if (up.includes("JOIN")) notes.push("-- JOIN: связываем таблицы");
  if (up.includes("WHERE")) notes.push("-- WHERE: фильтруем строки");
  if (up.includes("GROUP BY")) notes.push("-- GROUP BY: группируем результаты");
  if (up.includes("ORDER BY")) notes.push("-- ORDER BY: сортируем итог");
  return notes.length ? `/* Пояснения:\n${notes.join("\n")}\n*/\n` + sql : sql;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function getCleanSql(sql: string | null): string {
  if (!sql) return "";
  // Удаляем комментарии (/* ... */ и -- ...)
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "") // Удаляем многострочные комментарии
    .replace(/--.*$/gm, "") // Удаляем однострочные комментарии
    .trim();
}

/* -------------------- COMPONENT -------------------- */
export default function Home() {
  const router = useRouter();
  const [schemaJson, setSchemaJson] = useState<any | null>(null);
  const [nl, setNl] = useState("");
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [generatedSql, setGeneratedSql] = useState<string | null>(null);
  const [danger, setDanger] = useState(false);
  const [savepointSql, setSavepointSql] = useState<string | null>(null);
  const [explain, setExplain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sqlWarning, setSqlWarning] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [connectionString, setConnectionString] = useState<string | null>(null);
  const [dbType, setDbType] = useState<string>("postgres");
  const [hasActiveConnection, setHasActiveConnection] = useState<boolean>(false);
  const [limitModal, setLimitModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: "limit" | "error";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "limit",
  });

  // НЕ загружаем подключения из localStorage (безопасность - пароли не должны храниться в браузере)
  // Подключения должны загружаться из Supabase через компоненты подключений

  // Обновляем hasActiveConnection при изменении connectionString
  useEffect(() => {
    setHasActiveConnection(!!connectionString);
  }, [connectionString]);
  const [showTableModal, setShowTableModal] = useState<{
    sql: string;
    columns: string[];
    rows: any[];
  } | null>(null);
  const [executingSql, setExecutingSql] = useState(false);
  
  // Управление вкладками (свернутые модальные окна)
  interface TabData {
    id: string;
    title: string;
    sql: string;
    columns: string[];
    rows: any[];
  }
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  
  // Загружаем вкладки из sessionStorage при монтировании
  useEffect(() => {
    try {
      const savedTabs = sessionStorage.getItem("tableTabs");
      if (savedTabs) {
        const parsedTabs = JSON.parse(savedTabs);
        console.log("Загружены вкладки из sessionStorage:", parsedTabs);
        // Восстанавливаем только метаданные, rows будут загружены при разворачивании
        const restoredTabs = parsedTabs.map((tab: any, index: number) => {
          const restoredTab = {
            ...tab,
            title: tab.title || `Query ${index + 1}`, // Fallback если title отсутствует
            rows: [] // Не загружаем rows сразу, чтобы не перегружать память
          };
          console.log("Восстановлена вкладка:", {
            id: restoredTab.id,
            title: restoredTab.title,
            originalTitle: tab.title,
            titleType: typeof tab.title
          });
          return restoredTab;
        });
        setTabs(restoredTabs);
      }
    } catch (e) {
      console.error("Ошибка загрузки вкладок:", e);
    }
  }, []);
  
  // Сохраняем метаданные вкладок в sessionStorage (без rows для экономии памяти)
  useEffect(() => {
    if (tabs.length > 0) {
      try {
        const tabsMeta = tabs.map((tab, index) => {
          const meta = {
            id: tab.id,
            title: tab.title || `Query ${index + 1}`, // Fallback если title пустой
            sql: tab.sql,
            columns: tab.columns,
            rowCount: tab.rows.length
          };
          // Логируем сохранение для отладки
          if (!tab.title || tab.title.trim() === "") {
            console.warn("⚠️ Сохранение вкладки с пустым title:", {
              id: meta.id,
              title: meta.title,
              originalTab: tab
            });
          }
          return meta;
        });
        console.log("💾 Сохранение вкладок в sessionStorage, количество:", tabsMeta.length);
        sessionStorage.setItem("tableTabs", JSON.stringify(tabsMeta));
      } catch (e) {
        console.error("Ошибка сохранения вкладок:", e);
      }
    } else {
      sessionStorage.removeItem("tableTabs");
    }
  }, [tabs]);


  /* -------------------- AUTH GUARD -------------------- */
  useEffect(() => {
    try {
      setSignedIn(!!localStorage.getItem("jwt"));
    } catch {
      setSignedIn(false);
    }
  }, []);

  useEffect(() => {
    if (signedIn === false) router.replace("/auth");
  }, [signedIn, router]);

  /* -------------------- TOAST -------------------- */
  const [note, setNote] = useState<{ type: "ok" | "warn" | "err"; text: string } | null>(null);
  const toast = (type: "ok" | "warn" | "err", text: string) => {
    setNote({ type, text });
    // Убрано автоматическое закрытие - пользователь закрывает вручную
  };

  /* -------------------- ACTIONS -------------------- */
  const onGenerate = async () => {
    if (!schemaJson) return toast("warn", "Сначала загрузите схему");
    if (!nl.trim() && !fileContent) return toast("warn", "Введите задачу или загрузите файл");
    setLoading(true);
    
    // Формируем запрос с учетом файла
    let query = nl.trim();
    if (fileContent) {
      const fileContext = `\n\nКонтекст из файла "${fileName}":\n${fileContent}`;
      query = query ? query + fileContext : `Проанализируй содержимое файла и помоги сформировать SQL запросы.${fileContext}`;
    }
    
    try {

      const data = await generateSql(query, schemaJson, "postgres");
      if (data.blocked) return toast("err", "🚫 Запрос заблокирован политикой");

      const sql = String(data.sql || "");
      const finalSql = explain ? annotate(sql) : sql;
      console.log("SQL сгенерирован, длина:", finalSql.length, "hasActiveConnection:", hasActiveConnection);
      setGeneratedSql(finalSql);

      const apiSavepoint = data?.withSafety ?? data?.variantSavepoint ?? null;
      setSavepointSql(apiSavepoint);
      setDanger(!!apiSavepoint || DANGER_RE.test(sql));

      // Отправляем событие для обновления счетчика токенов
      window.dispatchEvent(new Event('sql-generated'));

      // Автоматически получаем предупреждение о возможных проблемах
      setSqlWarning(null);
      setReviewLoading(true);
      try {
        const reviewResult = await reviewSql({
          sql: sql,
          schema: schemaJson,
          dialect: dbType || "postgres",
          natural_language_query: query,
        });
        const reviewText = reviewResult.review?.trim() || "";
        // Показываем предупреждение только если есть реальная проблема (не "OK" и не пустое)
        if (reviewText && reviewText.toUpperCase() !== "OK" && !reviewText.includes("корректный")) {
          setSqlWarning(reviewText);
        }
      } catch (e: any) {
        // Игнорируем ошибки ревью (не критично)
        console.log("Ошибка получения предупреждения:", e.message);
      } finally {
        setReviewLoading(false);
      }

      // Логирование успешной генерации SQL
      logAction({
        action_type: 'sql_generation',
        natural_language_query: query,
        sql_query: sql,
        schema_used: schemaJson,
        dialect: 'postgres',
        tokens_used: data.tokens_used || undefined,
        success: true,
        file_info: fileContent ? { filename: fileName, size: fileContent.length } : undefined,
      });
    } catch (e: any) {
      console.error(e);
      const errorMessage = e?.message || "Ошибка генерации";
      
      // Логирование ошибки генерации SQL
      logAction({
        action_type: 'sql_generation',
        natural_language_query: query,
        schema_used: schemaJson,
        dialect: 'postgres',
        success: false,
        error_message: errorMessage,
        file_info: fileContent ? { filename: fileName, size: fileContent.length } : undefined,
      });
      
      // Проверяем, является ли это ошибкой лимита токенов
      if (errorMessage.includes("Достигнут лимит токенов") || errorMessage.includes("limit_reached")) {
        // Парсим информацию о лимите из сообщения
        const tokensUsedMatch = errorMessage.match(/Использовано:\s*(\d+)/);
        const tokenLimitMatch = errorMessage.match(/из\s*(\d+)/);
        const remainingMatch = errorMessage.match(/Осталось:\s*(\d+)/);
        
        const tokensUsed = tokensUsedMatch ? tokensUsedMatch[1] : "0";
        const tokenLimit = tokenLimitMatch ? tokenLimitMatch[1] : "0";
        const remaining = remainingMatch ? remainingMatch[1] : "0";
        
        setLimitModal({
          isOpen: true,
          title: "Достигнут лимит токенов",
          message: `Использовано: ${tokensUsed} из ${tokenLimit}\nОсталось: ${remaining} токенов\n\n💡 Для увеличения лимита перейдите на более высокий тариф.`,
          type: "limit",
        });
      } else {
        toast("err", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    if (!schemaJson) return toast("warn", "Нет схемы для сохранения");
    if (!saveName.trim()) return toast("warn", "Введите имя");
    try {
      await saveSchema(saveName.trim(), schemaJson);
      toast("ok", `Сохранено: «${saveName.trim()}» ✅`);
      
      // Логирование сохранения схемы
      logAction({
        action_type: 'schema_save',
        schema_used: schemaJson,
        success: true,
      });
      
      setSaveName("");
    } catch (e: any) {
      console.error(e);
      toast("err", "Ошибка сохранения");
      
      // Логирование ошибки сохранения схемы
      logAction({
        action_type: 'schema_save',
        schema_used: schemaJson,
        success: false,
        error_message: e?.message || "Ошибка сохранения схемы",
      });
    }
  };

  // Генерация SQL (если нужно) и показ таблицы
  const handleShowTable = async () => {
    // Проверяем подключение
    let connStr = connectionString;
    let connDbType = dbType;
    
    // НЕ загружаем connection string из localStorage (безопасность)

    if (!connStr) {
      toast("warn", "Сначала подключитесь к базе данных");
      return;
    }

    // Если SQL не сгенерирован, сначала генерируем его
    let sqlToExecute = generatedSql;
    
    if (!sqlToExecute) {
      // Проверяем, есть ли что генерировать
      if (!schemaJson) {
        toast("warn", "Сначала загрузите схему базы данных");
        return;
      }
      
      if (!nl.trim() && !fileContent) {
        toast("warn", "Введите запрос или загрузите файл для генерации SQL");
        return;
      }

      // Генерируем SQL
      setLoading(true);
      setExecutingSql(true);
      
      // Формируем запрос с учетом файла
      let query = nl.trim();
      if (fileContent) {
        const fileContext = `\n\nКонтекст из файла "${fileName}":\n${fileContent}`;
        query = query ? query + fileContext : `Проанализируй содержимое файла и помоги сформировать SQL запросы.${fileContext}`;
      }
      
      try {

        const data = await generateSql(query, schemaJson, "postgres");
        if (data.blocked) {
          toast("err", "🚫 Запрос заблокирован политикой");
          setLoading(false);
          setExecutingSql(false);
          return;
        }

        const sql = String(data.sql || "");
        sqlToExecute = explain ? annotate(sql) : sql;
        setGeneratedSql(sqlToExecute);

        const apiSavepoint = data?.withSafety ?? data?.variantSavepoint ?? null;
        setSavepointSql(apiSavepoint);
        setDanger(!!apiSavepoint || DANGER_RE.test(sql));

        // Отправляем событие для обновления счетчика токенов
        window.dispatchEvent(new Event('sql-generated'));

        // Логирование успешной генерации SQL
        logAction({
          action_type: 'sql_generation',
          natural_language_query: query,
          sql_query: sql,
          schema_used: schemaJson,
          dialect: 'postgres',
          tokens_used: data.tokens_used || undefined,
          success: true,
          file_info: fileContent ? { filename: fileName, size: fileContent.length } : undefined,
        });
      } catch (e: any) {
        console.error(e);
        const errorMessage = e?.message || "Ошибка генерации";
        
        // Логирование ошибки генерации SQL
        logAction({
          action_type: 'sql_generation',
          natural_language_query: query,
          schema_used: schemaJson,
          dialect: 'postgres',
          success: false,
          error_message: errorMessage,
          file_info: fileContent ? { filename: fileName, size: fileContent.length } : undefined,
        });
        
        toast("err", errorMessage);
        setLoading(false);
        setExecutingSql(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    // Теперь выполняем SQL и показываем таблицу
    setExecutingSql(true);
    const executionStartTime = Date.now();
    try {
      const cleanSql = getCleanSql(sqlToExecute);
      if (!cleanSql) {
        toast("warn", "SQL запрос пуст");
        setExecutingSql(false);
        return;
      }

      // Получаем JWT токен для авторизации
      const jwt = localStorage.getItem('jwt');
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (jwt) {
        headers["Authorization"] = `Bearer ${jwt}`;
      }
      
      const res = await fetch("/api/fetch-query", {
        method: "POST",
        headers,
        body: JSON.stringify({
          connectionString: connStr,
          query: cleanSql,
          dbType: connDbType,
        }),
      });

      console.log("📡 Ответ от API получен, статус:", res.status);
      const data = await res.json();
      console.log("📡 Данные от API:", { 
        success: data?.success, 
        hasError: !!data?.error,
        columnsCount: data?.columns?.length,
        rowsCount: data?.rows?.length 
      });
      
      const executionTime = Date.now() - executionStartTime;
      
      if (!res.ok || !data.success) {
        const errorMsg = data?.error || "Ошибка выполнения SQL";
        console.error("❌ Ошибка в данных API:", errorMsg);
        
        // Логирование ошибки выполнения SQL
        logAction({
          action_type: 'sql_execution',
          sql_query: cleanSql,
          dialect: connDbType,
          execution_time_ms: executionTime,
          success: false,
          error_message: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg),
        });
        
        throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
      }

      if (!data.columns || !Array.isArray(data.columns)) {
        console.error("❌ API вернул некорректные колонки:", data.columns);
        const errorMsg = "API вернул некорректный формат колонок";
        
        // Логирование ошибки выполнения SQL
        logAction({
          action_type: 'sql_execution',
          sql_query: cleanSql,
          dialect: connDbType,
          execution_time_ms: executionTime,
          success: false,
          error_message: errorMsg,
        });
        
        throw new Error(errorMsg);
      }

      const rows = Array.isArray(data.rows) ? data.rows : [];
      const modalData = {
        sql: cleanSql,
        columns: data.columns,
        rows: rows,
      };
      setShowTableModal(modalData);

      // Логирование успешного выполнения SQL
      logAction({
        action_type: 'sql_execution',
        sql_query: cleanSql,
        dialect: connDbType,
        rows_returned: rows.length,
        execution_time_ms: executionTime,
        success: true,
      });
    } catch (e: any) {
      console.error(e);
      const executionTime = Date.now() - executionStartTime;
      const errorMessage = e.message || "Ошибка выполнения SQL";
      
      // Логирование ошибки выполнения SQL
      const cleanSql = getCleanSql(sqlToExecute);
      if (cleanSql) {
        logAction({
          action_type: 'sql_execution',
          sql_query: cleanSql,
          dialect: connDbType,
          execution_time_ms: executionTime,
          success: false,
          error_message: errorMessage,
        });
      }
      
      toast("err", errorMessage);
    } finally {
      setExecutingSql(false);
    }
  };

  if (signedIn === null) return <div style={{ padding: 24, color: "#e5e7eb" }}>Загрузка…</div>;
  if (signedIn === false) return null;

  const plainSql = generatedSql ?? "";

  /* -------------------- RENDER -------------------- */
  return (
    <div style={{ maxWidth: 1400, width: 850, margin: "0 auto", padding: "40px 40px 100px", paddingBottom: tabs.length > 0 ? "60px" : "100px" }}>
      {/* ---- HEADER ---- */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 30,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Image
            src="/logo.png"
            alt="AI SQL Advisor"
            width={70}
            height={70}
            priority
            style={{
              borderRadius: 12,
              objectFit: "contain",
              boxShadow: "0 0 12px rgba(59,130,246,0.35)",
            }}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: 26, color: "#fff", fontWeight: 700 }}>
              AI SQL Advisor
            </h1>
            <p style={{ margin: 0, opacity: 0.75, fontSize: 14 }}>
              Генерация SQL и управление схемами
            </p>
          </div>
        </div>

        {signedIn && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
            {/* Счетчик токенов в header */}
            <TokenCounter />
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Link
              href="/logs"
              style={{
                background: "rgba(34, 211, 238, 0.1)",
                color: "#22d3ee",
                border: "1px solid rgba(34, 211, 238, 0.3)",
                borderRadius: 10,
                padding: "6px 14px",
                textDecoration: "none",
                fontWeight: 500,
                fontSize: 14,
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "rgba(34, 211, 238, 0.2)";
                e.currentTarget.style.borderColor = "rgba(34, 211, 238, 0.5)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "rgba(34, 211, 238, 0.1)";
                e.currentTarget.style.borderColor = "rgba(34, 211, 238, 0.3)";
              }}
            >
              📜 История
            </Link>
            <Link
              href="/tarify"
              style={{
                background: "rgba(96, 165, 250, 0.1)",
                color: "#60a5fa",
                border: "1px solid rgba(96, 165, 250, 0.3)",
                borderRadius: 10,
                padding: "6px 14px",
                textDecoration: "none",
                fontWeight: 500,
                fontSize: 14,
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "rgba(96, 165, 250, 0.2)";
                e.currentTarget.style.borderColor = "rgba(96, 165, 250, 0.5)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "rgba(96, 165, 250, 0.1)";
                e.currentTarget.style.borderColor = "rgba(96, 165, 250, 0.3)";
              }}
            >
              💰 Тарифы
            </Link>
            <button
              onClick={() => {
                localStorage.removeItem("jwt");
                location.reload();
              }}
              style={{
                background: "#0b1220",
                color: "#e5e7eb",
                border: "1px solid #1f2937",
                borderRadius: 10,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
            </div>
          </div>
        )}
      </header>

      {/* ---- MAIN ---- */}
      <div style={{ marginTop: -10 }}>
        {/* кнопка перехода */}
        <div style={{ display: "flex", justifyContent: "center", margin: "10px 0 30px" }}>
          <Link
            href="/sql-interface"
            style={{
              display: "inline-block",
              padding: "12px 26px",
              borderRadius: 14,
              textDecoration: "none",
              background: "linear-gradient(90deg,#22d3ee,#3b82f6)",
              color: "#0b1220",
              fontWeight: 700,
              fontSize: 16,
              boxShadow: "0 0 14px rgba(59,130,246,0.45)",
              transition: "transform 0.2s ease, box-shadow 0.25s ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 0 20px rgba(59,130,246,0.7)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 0 14px rgba(59,130,246,0.45)";
            }}
          >
            🚀 Перейти в конструктор
          </Link>
        </div>

        {/* основной блок */}
        <div
          style={{
            border: "1px solid #1f2937",
            borderRadius: 16,
            background: "#0f172a",
            padding: 26,
            maxWidth: "1400px",
            width: "100%",
            margin: "0 auto",
          }}
        >
          <div>
              <h3>Подключение и загрузка схемы</h3>
              <SimpleDbConnect 
                onLoaded={setSchemaJson} 
                onToast={toast}
                onConnectionString={(connStr, dbType) => {
                  // Не логируем connection strings (безопасность)
                  console.log("Подключение установлено, dbType:", dbType);
                  setConnectionString(connStr);
                  setDbType(dbType);
                  setHasActiveConnection(true);
                  // НЕ сохраняем connection string в localStorage (безопасность)
                }}
              />

              {schemaJson && (
                <>
                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={badge}>
                      Схема загружена • таблиц:{" "}
                      {schemaJson.countTables ?? Object.keys(schemaJson.tables || {}).length}
                    </span>
                    {hasActiveConnection && (
                      <span style={{
                        ...badge,
                        background: "#22d3ee20",
                        color: "#0891b2",
                        border: "1px solid #22d3ee50",
                      }}>
                        ✅ Подключение доступно
                      </span>
                    )}
                    {!hasActiveConnection && (
                      <span style={{
                        ...badge,
                        background: "#f59e0b20",
                        color: "#d97706",
                        border: "1px solid #f59e0b50",
                      }}>
                        ⚠️ Подключение не установлено
                      </span>
                    )}
                  </div>
                  <details style={{ marginTop: 10 }}>
                    <summary>Показать JSON-схему</summary>
                    <pre style={pre}>{JSON.stringify(schemaJson, null, 2)}</pre>
                  </details>

                  <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                    <input
                      placeholder="например: neon_demo"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      style={input}
                    />
                    <button onClick={onSave} style={btnMain}>
                      💾 Сохранить
                    </button>
                  </div>
                </>
              )}

              <hr style={{ borderColor: "#1f2937", margin: "20px 0" }} />

              <h3>Генерация SQL</h3>
              
              {/* Кнопки сверху - История запросов и Частые запросы (симметрично) */}
              <div style={{ display: "flex", gap: "16px", marginTop: "20px", marginBottom: "16px", justifyContent: "center" }}>
                <Link
                  href="/logs"
                  style={{
                    width: "280px",
                    padding: "10px 16px",
                    background: "rgba(96, 165, 250, 0.1)",
                    border: "1px solid rgba(96, 165, 250, 0.3)",
                    borderRadius: "8px",
                    color: "#60a5fa",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 500,
                    textAlign: "center",
                    transition: "all 0.2s",
                    display: "block",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "rgba(96, 165, 250, 0.2)";
                    e.currentTarget.style.borderColor = "rgba(96, 165, 250, 0.5)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "rgba(96, 165, 250, 0.1)";
                    e.currentTarget.style.borderColor = "rgba(96, 165, 250, 0.3)";
                  }}
                >
                  📜 История запросов
                </Link>
                <div style={{ width: "280px" }}>
                  <FrequentQueriesDropdown
                    onSelectQuery={(sql) => {
                      setNl(sql);
                      setTimeout(() => {
                        onGenerate();
                      }, 100);
                    }}
                  />
                </div>
              </div>

              {/* Поле ввода - на всю ширину, как было */}
              <textarea
                placeholder="Например: 'Покажи имена и email клиентов...' или загрузите файл для анализа"
                value={nl}
                onChange={(e) => setNl(e.target.value)}
                rows={5}
                style={input}
              />
              
              {/* Пояснить SQL и Загрузить файл - рядом */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: 10 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                    opacity: 0.9,
                    padding: "10px 12px",
                    background: "rgba(34, 211, 238, 0.05)",
                    border: "1px solid rgba(34, 211, 238, 0.2)",
                    borderRadius: "8px",
                  }}
                >
                  <input
                    id="explain"
                    type="checkbox"
                    checked={explain}
                    onChange={(e) => setExplain(e.target.checked)}
                    style={{
                      width: "18px",
                      height: "18px",
                      cursor: "pointer",
                      accentColor: "#22d3ee",
                    }}
                  />
                  <label 
                    htmlFor="explain" 
                    style={{
                      color: "#e5e7eb",
                      fontSize: "14px",
                      cursor: "pointer",
                      userSelect: "none",
                      fontWeight: 500,
                    }}
                  >
                    💡 Пояснить SQL
                  </label>
                </div>
                <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px" }}>
                  <CompactFileUpload
                    onFileLoaded={(content, name) => {
                      setFileContent(content);
                      setFileName(name);
                      toast("ok", `Файл "${name}" загружен ✅`);
                    }}
                    onError={(error) => toast("err", error)}
                    uploadedFile={fileName}
                  />
                  <span style={{ color: "#9ca3af", fontSize: "12px", whiteSpace: "nowrap" }}>
                    .SQL, .CSV, .XLSX, .XLS, .JSON, .PDF, .DOC, .DOCX, .TXT
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={onGenerate} disabled={loading} style={btnMain}>
                  {loading ? "⏳ Генерируем…" : "Сгенерировать"}
                </button>
                <button
                  onClick={handleShowTable}
                  disabled={executingSql || loading || !hasActiveConnection || !schemaJson || (!nl.trim() && !fileContent)}
                  title={
                    !hasActiveConnection
                      ? "Сначала подключитесь к базе данных"
                      : !schemaJson
                      ? "Сначала загрузите схему базы данных"
                      : !nl.trim() && !fileContent
                      ? "Введите запрос или загрузите файл"
                      : executingSql || loading
                      ? executingSql ? "Выполняется SQL запрос..." : "Генерируется SQL..."
                      : "Сгенерировать SQL и показать результаты в таблице"
                  }
                  style={{
                    ...btnMain,
                    opacity: (executingSql || loading || !hasActiveConnection || !schemaJson || (!nl.trim() && !fileContent)) ? 0.5 : 1,
                    cursor: (executingSql || loading || !hasActiveConnection || !schemaJson || (!nl.trim() && !fileContent)) ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "⏳ Генерируем…" : executingSql ? "⏳ Выполняется…" : "📊 Показать таблицу"}
                </button>
                <button
                  onClick={() => {
                    setGeneratedSql(null);
                    setDanger(false);
                    setSavepointSql(null);
                    setNl("");
                    setFileContent(null);
                    setFileName(null);
                    setShowTableModal(null);
                    setSqlWarning(null);
                  }}
                  style={btnSec}
                >
                  Очистить
                </button>
              </div>

              {generatedSql && (
                <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                  {/* Автоматическое предупреждение о возможных проблемах */}
                  {(sqlWarning || reviewLoading) && (
                    <div
                      style={{
                        background: "rgba(251, 191, 36, 0.1)",
                        border: "1px solid rgba(251, 191, 36, 0.3)",
                        borderRadius: "8px",
                        padding: "12px 16px",
                        position: "relative",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                            <span style={{ color: "#fbbf24", fontSize: "16px" }}>⚠️</span>
                            <span style={{ color: "#fbbf24", fontSize: "14px", fontWeight: 600 }}>
                              Предупреждение: запрос может упустить данные
                            </span>
                          </div>
                          {reviewLoading ? (
                            <div style={{ color: "#9ca3af", fontSize: "13px" }}>Анализирую запрос...</div>
                          ) : sqlWarning ? (
                            <>
                              <div style={{ color: "#e5e7eb", fontSize: "13px", lineHeight: "1.5", marginBottom: "12px" }}>
                                {sqlWarning}
                              </div>
                              <button
                                onClick={async () => {
                                  // Генерируем улучшенный SQL с учетом подсказки
                                  if (!schemaJson) return toast("warn", "Сначала загрузите схему");
                                  const currentQuery = nl.trim() || (fileContent ? `Проанализируй содержимое файла и помоги сформировать SQL запросы.\n\nКонтекст из файла "${fileName}":\n${fileContent}` : "");
                                  
                                  // Добавляем инструкцию с учетом предупреждения
                                  const improvedQuery = `${currentQuery}\n\nВАЖНО: ${sqlWarning}\n\nСгенерируй улучшенный SQL запрос с учетом этого предупреждения.`;
                                  
                                  setLoading(true);
                                  try {
                                    const data = await generateSql(improvedQuery, schemaJson, dbType || "postgres");
                                    if (data.blocked) return toast("err", "🚫 Запрос заблокирован политикой");

                                    const sql = String(data.sql || "");
                                    const finalSql = explain ? annotate(sql) : sql;
                                    setGeneratedSql(finalSql);

                                    const apiSavepoint = data?.withSafety ?? data?.variantSavepoint ?? null;
                                    setSavepointSql(apiSavepoint);
                                    setDanger(!!apiSavepoint || DANGER_RE.test(sql));

                                    // Очищаем предупреждение после улучшения
                                    setSqlWarning(null);
                                    window.dispatchEvent(new Event('sql-generated'));
                                  } catch (e: any) {
                                    toast("err", e.message || "Ошибка генерации");
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                                disabled={loading}
                                style={{
                                  padding: "8px 16px",
                                  background: "rgba(34, 211, 238, 0.2)",
                                  border: "1px solid rgba(34, 211, 238, 0.5)",
                                  borderRadius: "6px",
                                  color: "#22d3ee",
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  cursor: loading ? "not-allowed" : "pointer",
                                  opacity: loading ? 0.5 : 1,
                                }}
                              >
                                {loading ? "⏳ Генерирую..." : "🔄 Сгенерировать улучшенный запрос"}
                              </button>
                            </>
                          ) : null}
                        </div>
                        <button
                          onClick={() => setSqlWarning(null)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#9ca3af",
                            fontSize: "18px",
                            cursor: "pointer",
                            padding: "0",
                            width: "24px",
                            height: "24px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {danger && (
                    <div
                      style={{
                        border: "1px solid #ef444460",
                        background: "#ef444420",
                        color: "#fecaca",
                        borderRadius: 12,
                        padding: "10px 12px",
                        fontWeight: 600,
                      }}
                    >
                      ⚠️ Потенциально опасный запрос — проверьте перед выполнением.
                    </div>
                  )}

                  <div style={resultCard}>
                    <div style={resultHdr}>
                      <span>Обычный вариант</span>
                      <button
                        onClick={async () =>
                          (await copy(plainSql))
                            ? toast("ok", "Скопировано")
                            : toast("err", "Ошибка копирования")
                        }
                        style={copyBtn}
                      >
                        Скопировать
                      </button>
                    </div>
                    <pre style={pre}>{plainSql}</pre>
                  </div>

                  {savepointSql && (
                    <div style={resultCard}>
                      <div style={resultHdr}>
                        <span>Вариант с SAVEPOINT</span>
                        <button
                          onClick={async () =>
                            (await copy(savepointSql))
                              ? toast("ok", "Скопировано")
                              : toast("err", "Ошибка копирования")
                          }
                          style={copyBtn}
                        >
                          Скопировать
                        </button>
                      </div>
                      <pre style={pre}>{savepointSql}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
        </div>
      </div>

      {/* ---- MODAL ---- */}
      {/* Приоритет отдаем showTableModal (новое окно), если его нет - activeTabId (окно из вкладки) */}
      {(showTableModal || (activeTabId && tabs.find(t => t.id === activeTabId))) && (
        <DataTableModal
          id={showTableModal ? "generated-sql-table" : activeTabId!}
          sql={showTableModal ? showTableModal.sql : tabs.find(t => t.id === activeTabId)!.sql}
          columns={showTableModal ? showTableModal.columns : tabs.find(t => t.id === activeTabId)!.columns}
          rows={showTableModal ? showTableModal.rows : tabs.find(t => t.id === activeTabId)!.rows}
          currentName={showTableModal ? "" : tabs.find(t => t.id === activeTabId)?.title}
          onClose={(id) => {
            console.log("Закрытие модального окна:", id);
            if (showTableModal) {
              setShowTableModal(null);
            } else {
              setActiveTabId(null);
            }
          }}
          onMinimize={(id, tabName) => {
            console.log("🔵 onMinimize вызван:", { id, tabName, isNew: !!showTableModal });
            
            // Сохраняем данные если это новое окно
            const modalData = showTableModal;
            
            // Пытаемся найти существующую вкладку
            const existingTab = tabs.find(t => t.id === id);
            
            // Нормализуем имя
            let normalizedName = (tabName && typeof tabName === "string" && tabName.trim()) 
              ? tabName.trim() 
              : null;

            if (modalData) {
              // Сворачиваем новое окно в вкладку
              const tabId = `tab-${Date.now()}`;
              const finalName = normalizedName || `Query ${tabs.length + 1}`;
              console.log("🔵 Создание новой вкладки:", { tabId, finalName });
              
              setTabs(prev => [
                ...prev,
                {
                  id: tabId,
                  title: finalName,
                  sql: modalData.sql,
                  columns: modalData.columns,
                  rows: modalData.rows,
                }
              ]);
              setShowTableModal(null);
            } else {
              // Переименовываем существующую вкладку если введено НОВОЕ имя
              // Если имя пустое, оставляем старое
              if (normalizedName && existingTab && existingTab.title !== normalizedName) {
                console.log("🔵 Переименование вкладки:", { id, normalizedName });
                setTabs(prev => prev.map(t => t.id === id ? { ...t, title: normalizedName! } : t));
              }
              setActiveTabId(null);
            }
          }}
        />
      )}
      
      {/* Панель вкладок снизу */}
      <TableTabsBar
        tabs={tabs.map(tab => {
          const mappedTab = {
            id: tab.id,
            title: tab.title || `Query ${tabs.indexOf(tab) + 1}`, // Fallback если title пустой
            sql: tab.sql,
            columns: tab.columns,
            rowCount: tab.rows.length,
          };
          // Логируем только если title выглядит как число (для отладки)
          if (mappedTab.title && /^\d+$/.test(mappedTab.title)) {
            console.warn("⚠️ Вкладка с числовым title:", {
              id: mappedTab.id,
              title: mappedTab.title,
              originalTab: tab,
              tabTitleType: typeof tab.title,
              tabTitleValue: tab.title
            });
          }
          return mappedTab;
        })}
        activeTabId={activeTabId}
        onTabClick={(id) => {
          setActiveTabId(id);
        }}
        onTabClose={(id) => {
          setTabs(tabs.filter(t => t.id !== id));
          if (activeTabId === id) {
            setActiveTabId(null);
          }
        }}
        onTabRename={(id, newTitle) => {
          setTabs(tabs.map(t => t.id === id ? { ...t, title: newTitle } : t));
        }}
      />

      {/* ---- LIMIT MODAL ---- */}
      <LimitModal
        isOpen={limitModal.isOpen}
        onClose={() => setLimitModal({ ...limitModal, isOpen: false })}
        title={limitModal.title}
        message={limitModal.message}
        type={limitModal.type}
      />

      {/* ---- TOAST ---- */}
      {note && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 50,
            background:
              note.type === "ok"
                ? "#10b98120"
                : note.type === "warn"
                ? "#f59e0b20"
                : "#ef444420",
            border: `1px solid ${
              note.type === "ok" ? "#10b98160" : note.type === "warn" ? "#f59e0b60" : "#ef444460"
            }`,
            color: "#e5e7eb",
            padding: "10px 12px",
            paddingRight: "32px",
            borderRadius: 10,
            maxWidth: "400px",
            fontSize: "0.875rem",
            lineHeight: "1.4",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          <span style={{ flex: 1, wordBreak: "break-word" }}>{note.text}</span>
          <button
            onClick={() => setNote(null)}
            style={{
              position: "absolute",
              top: "6px",
              right: "6px",
              background: "transparent",
              border: "none",
              color: "#9ca3af",
              cursor: "pointer",
              padding: "2px 4px",
              borderRadius: "4px",
              fontSize: "16px",
              lineHeight: "1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "20px",
              height: "20px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
              e.currentTarget.style.color = "#e5e7eb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#9ca3af";
            }}
            title="Закрыть"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------- STYLES -------------------- */
const input = {
  background: "#0b1220",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: "10px 12px",
  flex: 1,
};
const btnMain = {
  background: "linear-gradient(90deg,#22d3ee,#3b82f6)",
  color: "#0b1220",
  fontWeight: 700,
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  cursor: "pointer",
};
const btnSec = {
  background: "#0b1220",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: "10px 14px",
  cursor: "pointer",
};
const badge = {
  background: "#10b98120",
  color: "#065f46",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  border: "1px solid #10b98150",
};
const pre = {
  whiteSpace: "pre-wrap",
  background: "#0b1220",
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: 12,
  fontSize: 13,
};
const resultCard = {
  border: "1px solid #1f2937",
  borderRadius: 12,
  background: "#0b1220",
  padding: 12,
};
const resultHdr = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
  color: "#e5e7eb",
  fontWeight: 600,
};
const copyBtn = {
  background: "#111827",
  color: "#e5e7eb",
  border: "1px solid #374151",
  borderRadius: 10,
  padding: "6px 10px",
  cursor: "pointer",
};
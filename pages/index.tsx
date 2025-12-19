import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import SimpleDbConnect from "@/components/SimpleDbConnect";
import FileUpload from "@/components/FileUpload";
import DataTableModal from "@/components/DataTableModal";
import TableTabsBar from "@/components/TableTabsBar";
import { generateSql, saveSchema } from "@/lib/api";

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
  const [saveName, setSaveName] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [connectionString, setConnectionString] = useState<string | null>(null);
  const [dbType, setDbType] = useState<string>("postgres");
  const [hasActiveConnection, setHasActiveConnection] = useState<boolean>(false);

  // Загружаем последнее подключение из localStorage при монтировании
  useEffect(() => {
    const loadLastConnection = () => {
      try {
        const lastConn = localStorage.getItem("lastConnection");
        if (lastConn) {
          const conn = JSON.parse(lastConn);
          if (conn.connectionString) {
            setConnectionString(conn.connectionString);
            setDbType(conn.dbType || "postgres");
            setHasActiveConnection(true);
            console.log("Загружено подключение из localStorage");
          } else {
            setHasActiveConnection(false);
          }
        } else {
          setHasActiveConnection(false);
        }
      } catch (e) {
        console.error("Ошибка загрузки последнего подключения:", e);
        setHasActiveConnection(false);
      }
    };
    
    loadLastConnection();
    
    // Слушаем изменения в localStorage (на случай, если подключение изменилось в другой вкладке)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "lastConnection") {
        loadLastConnection();
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Обновляем hasActiveConnection при изменении connectionString
  useEffect(() => {
    if (connectionString) {
      setHasActiveConnection(true);
    } else {
      // Проверяем localStorage если connectionString пустой
      try {
        const lastConn = localStorage.getItem("lastConnection");
        if (lastConn) {
          const conn = JSON.parse(lastConn);
          setHasActiveConnection(!!conn.connectionString);
        } else {
          setHasActiveConnection(false);
        }
      } catch (e) {
        setHasActiveConnection(false);
      }
    }
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
    setTimeout(() => setNote(null), 2200);
  };

  /* -------------------- ACTIONS -------------------- */
  const onGenerate = async () => {
    if (!schemaJson) return toast("warn", "Сначала загрузите схему");
    if (!nl.trim() && !fileContent) return toast("warn", "Введите задачу или загрузите файл");
    setLoading(true);
    try {
      // Формируем запрос с учетом файла
      let query = nl.trim();
      if (fileContent) {
        const fileContext = `\n\nКонтекст из файла "${fileName}":\n${fileContent}`;
        query = query ? query + fileContext : `Проанализируй содержимое файла и помоги сформировать SQL запросы.${fileContext}`;
      }

      const data = await generateSql(query, schemaJson, "postgres");
      if (data.blocked) return toast("err", "🚫 Запрос заблокирован политикой");

      const sql = String(data.sql || "");
      const finalSql = explain ? annotate(sql) : sql;
      console.log("SQL сгенерирован, длина:", finalSql.length, "hasActiveConnection:", hasActiveConnection);
      setGeneratedSql(finalSql);

      const apiSavepoint = data?.withSafety ?? data?.variantSavepoint ?? null;
      setSavepointSql(apiSavepoint);
      setDanger(!!apiSavepoint || DANGER_RE.test(sql));
    } catch (e: any) {
      console.error(e);
      const errorMessage = e?.message || "Ошибка генерации";
      toast("err", errorMessage);
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
      setSaveName("");
    } catch (e) {
      console.error(e);
      toast("err", "Ошибка сохранения");
    }
  };

  // Генерация SQL (если нужно) и показ таблицы
  const handleShowTable = async () => {
    // Проверяем подключение
    let connStr = connectionString;
    let connDbType = dbType;
    
    if (!connStr) {
      try {
        const lastConn = localStorage.getItem("lastConnection");
        if (lastConn) {
          const conn = JSON.parse(lastConn);
          connStr = conn.connectionString;
          connDbType = conn.dbType || "postgres";
          setConnectionString(connStr);
          setDbType(connDbType);
        }
      } catch (e) {
        console.error("Ошибка загрузки подключения:", e);
      }
    }

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
      try {
        let query = nl.trim();
        if (fileContent) {
          const fileContext = `\n\nКонтекст из файла "${fileName}":\n${fileContent}`;
          query = query ? query + fileContext : `Проанализируй содержимое файла и помоги сформировать SQL запросы.${fileContext}`;
        }

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
      } catch (e: any) {
        console.error(e);
        const errorMessage = e?.message || "Ошибка генерации";
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
    try {
      const cleanSql = getCleanSql(sqlToExecute);
      if (!cleanSql) {
        toast("warn", "SQL запрос пуст");
        setExecutingSql(false);
        return;
      }

      console.log("📡 Запрос к API /api/fetch-query...");
      const res = await fetch("/api/fetch-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      
      if (!res.ok || !data.success) {
        const errorMsg = data?.error || "Ошибка выполнения SQL";
        console.error("❌ Ошибка в данных API:", errorMsg);
        throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
      }

      if (!data.columns || !Array.isArray(data.columns)) {
        console.error("❌ API вернул некорректные колонки:", data.columns);
        throw new Error("API вернул некорректный формат колонок");
      }

      const modalData = {
        sql: cleanSql,
        columns: data.columns,
        rows: Array.isArray(data.rows) ? data.rows : [],
      };
      setShowTableModal(modalData);
    } catch (e: any) {
      console.error(e);
      toast("err", e.message || "Ошибка выполнения SQL");
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
            width: 850,
          }}
        >
          <div>
              <h3>Подключение и загрузка схемы</h3>
              <SimpleDbConnect 
                onLoaded={setSchemaJson} 
                onToast={toast}
                onConnectionString={(connStr, dbType) => {
                  console.log("ConnectionString установлен:", connStr.substring(0, 50) + "...", "dbType:", dbType);
                  setConnectionString(connStr);
                  setDbType(dbType);
                  setHasActiveConnection(true);
                  // Также проверяем, что сохранилось в localStorage
                  setTimeout(() => {
                    const saved = localStorage.getItem("lastConnection");
                    console.log("Проверка localStorage после подключения:", saved ? "есть" : "нет");
                    if (saved) {
                      try {
                        const conn = JSON.parse(saved);
                        setHasActiveConnection(!!conn.connectionString);
                      } catch (e) {
                        console.error("Ошибка парсинга lastConnection:", e);
                      }
                    }
                  }, 100);
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
              
              {/* Загрузка файлов */}
              <div style={{ marginBottom: 16 }}>
                <FileUpload
                  onFileLoaded={(content, name) => {
                    setFileContent(content);
                    setFileName(name);
                    toast("ok", `Файл "${name}" загружен ✅`);
                  }}
                  onError={(error) => toast("err", error)}
                />
              </div>

              <textarea
                placeholder="Например: 'Покажи имена и email клиентов...' или загрузите файл для анализа"
                value={nl}
                onChange={(e) => setNl(e.target.value)}
                rows={5}
                style={input}
              />
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 10,
                  fontSize: 14,
                  opacity: 0.9,
                }}
              >
                <input
                  id="explain"
                  type="checkbox"
                  checked={explain}
                  onChange={(e) => setExplain(e.target.checked)}
                />
                <label htmlFor="explain">Пояснить SQL</label>
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
                  }}
                  style={btnSec}
                >
                  Очистить
                </button>
              </div>

              {generatedSql && (
                <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
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
            borderRadius: 10,
          }}
        >
          {note.text}
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
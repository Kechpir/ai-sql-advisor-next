import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
// import SqlResult from "../components/SqlResult"; // больше не нужен
import DbConnect from "../components/DbConnect";
import SchemasManager from "./components/SchemasManager";
import { generateSql, saveSchema } from "../lib/api";

/** --- helpers --- */
const DANGER_RE =
  /\b(DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|DELETE|UPDATE|INSERT|MERGE)\b/i;

function annotate(sql: string) {
  const up = sql.toUpperCase();
  const notes: string[] = [];
  if (up.includes("SELECT")) notes.push("-- SELECT: какие колонки выводим и зачем");
  if (up.includes("FROM")) notes.push("-- FROM: источник данных — таблица или представление");
  if (up.includes("JOIN")) notes.push("-- JOIN: связываем таблицы, чтобы получить связанные поля");
  if (up.includes("WHERE")) notes.push("-- WHERE: фильтруем строки по условию");
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

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<"scan" | "saved">("scan");
  const [schemaJson, setSchemaJson] = useState<any | null>(null);
  const [nl, setNl] = useState("");
  const [generatedSql, setGeneratedSql] = useState<string | null>(null);
  const [danger, setDanger] = useState<boolean>(false);
  const [savepointSql, setSavepointSql] = useState<string | null>(null);
  const [explain, setExplain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

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

  const [note, setNote] = useState<{ type: "ok" | "warn" | "err"; text: string } | null>(null);
  const toast = (type: "ok" | "warn" | "err", text: string) => {
    setNote({ type, text });
    setTimeout(() => setNote(null), 2200);
  };

  const onGenerate = async () => {
    if (!schemaJson) return toast("warn", "Сначала загрузите схему");
    if (!nl.trim()) return toast("warn", "Введите задачу");
    setLoading(true);
    try {
      const data = await generateSql(nl.trim(), schemaJson, "postgres");
      if (data.blocked) {
        toast("err", "🚫 Запрос заблокирован политикой");
        return;
      }
      const sql = String(data.sql || "");
      const finalSql = explain ? annotate(sql) : sql;
      setGeneratedSql(finalSql);
      const apiSavepoint: string | null =
        (data?.withSafety ?? data?.variantSavepoint ?? null) || null;
      setSavepointSql(apiSavepoint);
      setDanger(!!apiSavepoint || DANGER_RE.test(sql));
    } catch (e: any) {
      console.error(e);
      toast("err", "Ошибка генерации");
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
    } catch (e: any) {
      console.error(e);
      toast("err", "Ошибка сохранения");
    }
  };

  if (signedIn === null) return <div style={{ padding: 24, color: "#e5e7eb" }}>Загрузка…</div>;
  if (signedIn === false) return null;

  const plainSql = generatedSql ?? "";

  return (
    <div>
      <div className="page-wrap">
        {/* Auth topbar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <span style={{ opacity: 0.85 }}>{signedIn ? "Signed in" : "Guest"}</span>
          {signedIn && (
            <button
              onClick={() => {
                try {
                  localStorage.removeItem("jwt");
                  location.reload();
                } catch (e) {
                  console.error(e);
                }
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
        </div>

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

        <h1 style={{ margin: 0 }}>🧠 AI SQL Advisor</h1>
        <p style={{ margin: "6px 0 20px", opacity: 0.8 }}>Генерация SQL и управление схемами.</p>

        {/* ✅ Новая кнопка перехода на SQL интерфейс */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <Link
            href="/sql-interface"
            className="px-6 py-3 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700 transition"
          >
            Перейти в SQL интерфейс
          </Link>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setTab("scan")} style={tabBtn(tab === "scan")}>
            🔎 Сканировать
          </button>
          <button onClick={() => setTab("saved")} style={tabBtn(tab === "saved")}>
            💾 Сохранённые базы
          </button>
        </div>

        {tab === "scan" && (
          <div style={block}>
            <h3>Подключение и загрузка схемы</h3>
            <DbConnect onLoaded={setSchemaJson} onToast={toast} />
            {schemaJson && (
              <>
                <div style={{ marginTop: 12 }}>
                  <span style={badge}>
                    Схема загружена • таблиц:{" "}
                    {schemaJson.countTables ?? Object.keys(schemaJson.tables || {}).length}
                  </span>
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
            <textarea
              placeholder="Например: 'Покажи имена и email клиентов...'"
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
                whiteSpace: "nowrap",
              }}
            >
              <input
                id="explain"
                type="checkbox"
                checked={explain}
                onChange={(e) => setExplain(e.target.checked)}
              />
              <label htmlFor="explain" style={{ cursor: "pointer", margin: 0 }}>
                Пояснить SQL
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={onGenerate} disabled={loading} style={btnMain}>
                {loading ? "⏳ Генерируем…" : "Сгенерировать"}
              </button>
              <button
                onClick={() => {
                  setGeneratedSql(null);
                  setDanger(false);
                  setSavepointSql(null);
                  setNl("");
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
                    ⚠️ Запрос может быть опасен (DROP/ALTER/DELETE и т.д.) — проверь перед
                    выполнением!
                  </div>
                )}

                <div style={resultCard}>
                  <div style={resultHdr}>
                    <span>Обычный вариант</span>
                    <button
                      onClick={async () =>
                        (await copy(plainSql))
                          ? toast("ok", "Скопировано")
                          : toast("err", "Не удалось скопировать")
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
                      <span>Вариант с SAVEPOINT (безопасный)</span>
                      <button
                        onClick={async () =>
                          (await copy(savepointSql))
                            ? toast("ok", "Скопировано")
                            : toast("err", "Не удалось скопировать")
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
        )}

        {tab === "saved" && (
          <div style={block}>
            <SchemasManager schemaJson={schemaJson} setSchemaJson={setSchemaJson} />
          </div>
        )}
      </div>
    </div>
  );
}

const tabBtn = (active: boolean) => ({
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #1f2937",
  background: active ? "#111827" : "#0f172a",
  color: "#e5e7eb",
  cursor: "pointer",
});

const block = {
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: 16,
  background: "#0f172a",
};

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
} as const;

const resultHdr = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
  color: "#e5e7eb",
  fontWeight: 600,
} as const;

const copyBtn = {
  background: "#111827",
  color: "#e5e7eb",
  border: "1px solid #374151",
  borderRadius: 10,
  padding: "6px 10px",
  cursor: "pointer",
} as const;

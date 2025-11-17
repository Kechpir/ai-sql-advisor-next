import React, { useState } from "react";

export default function ConnectionManager({
  onConnected,
}: {
  onConnected: (schema: any, dialect: string) => void;
}) {
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("postgres");
  const [user, setUser] = useState("postgres");
  const [password, setPassword] = useState("");
  const [dialect, setDialect] = useState("postgres");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleConnect = async () => {
    setStatus("loading");
    setMessage("Подключаюсь...");

    try {
      const res = await fetch("/api/connect-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port, database, user, password, dialect }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus("ok");
        setMessage("✅ Успешное подключение!");
        onConnected(data.schema, dialect);
      } else {
        throw new Error(data.error || "Ошибка подключения");
      }
    } catch (err: any) {
      console.error("Connection failed:", err);
      setStatus("error");
      setMessage("❌ Не удалось подключиться к базе данных");
    }
  };

  const inputStyle =
    "w-full rounded-lg bg-[#0b1220] text-gray-200 border border-[#1f2937] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00f5ff80]";
  const labelStyle = "block text-sm mb-1 text-gray-400";

  return (
    <div className="p-4 rounded-2xl border border-[#1f2937] bg-[#0d1117] shadow-lg space-y-3">
      <h3 className="text-xl font-semibold text-[#00f5ff] text-center drop-shadow-[0_0_10px_#00f5ff]">
        🔗 Подключение к базе данных
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelStyle}>Хост</label>
          <input value={host} onChange={(e) => setHost(e.target.value)} className={inputStyle} />
        </div>

        <div>
          <label className={labelStyle}>Порт</label>
          <input value={port} onChange={(e) => setPort(e.target.value)} className={inputStyle} />
        </div>

        <div>
          <label className={labelStyle}>База данных</label>
          <input
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            className={inputStyle}
          />
        </div>

        <div>
          <label className={labelStyle}>Пользователь</label>
          <input value={user} onChange={(e) => setUser(e.target.value)} className={inputStyle} />
        </div>

        <div>
          <label className={labelStyle}>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputStyle}
          />
        </div>

        <div>
          <label className={labelStyle}>Тип SQL</label>
          <select
            value={dialect}
            onChange={(e) => setDialect(e.target.value)}
            className={inputStyle}
          >
            <option value="postgres">PostgreSQL</option>
            <option value="mysql">MySQL</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleConnect}
        disabled={status === "loading"}
        className={`w-full py-2 rounded-lg font-semibold text-black transition-all ${
          status === "loading"
            ? "bg-gray-500 cursor-not-allowed"
            : "bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-[1.02]"
        }`}
      >
        {status === "loading" ? "⏳ Подключаюсь..." : "⚡ Подключиться"}
      </button>

      {message && (
        <p
          className={`text-sm text-center ${
            status === "ok"
              ? "text-green-400"
              : status === "error"
              ? "text-red-400"
              : "text-gray-400"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

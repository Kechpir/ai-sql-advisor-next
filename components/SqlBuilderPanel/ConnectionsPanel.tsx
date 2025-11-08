import React, { useState, useEffect } from "react";

interface Connection {
  name: string;
  url: string;
}

interface Props {
  onSelect: (url: string) => void;
}

const STORAGE_KEY = "savedConnections";

export default function ConnectionsPanel({ onSelect }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  // 🧠 Загрузка сохранённых подключений из localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setConnections(parsed);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // 💾 Сохранить все подключения
  const saveConnections = (list: Connection[]) => {
    setConnections(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  // ➕ Добавить новое подключение
  const handleAdd = () => {
    if (!name.trim() || !url.trim()) {
      alert("Введите имя и URL!");
      return;
    }

    if (connections.some((c) => c.name === name.trim())) {
      alert("Такое подключение уже существует!");
      return;
    }

    const updated = [...connections, { name: name.trim(), url: url.trim() }];
    saveConnections(updated);
    setName("");
    setUrl("");
  };

  // 🗑 Удалить подключение
  const handleDelete = (target: string) => {
    const updated = connections.filter((c) => c.name !== target);
    saveConnections(updated);
    if (selected === target) {
      setSelected("");
      onSelect(""); // ⚠️ сброс подключения
    }
  };

  // 🔄 Выбор подключения
  const handleSelect = (name: string) => {
    setSelected(name);
    const found = connections.find((c) => c.name === name);
    if (found) {
      onSelect(found.url); // ⚡ передаём строку подключения вверх
    }
  };

  return (
    <div className="input-group" style={{ marginBottom: "20px" }}>
      <label className="text-cyan-300 font-semibold text-sm mb-1">
        🗂 Подключения к БД
      </label>

      {/* Выбор подключения */}
      <div className="flex gap-2 mb-2">
        <select
          className="flex-1 p-2 rounded bg-[#101a33] border border-[#233861] text-sm text-gray-200"
          value={selected}
          onChange={(e) => handleSelect(e.target.value)}
        >
          <option value="">— выберите подключение —</option>
          {connections.length > 0 ? (
            connections.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))
          ) : (
            <option disabled>(нет сохранённых)</option>
          )}
        </select>

        {selected && (
          <button
            onClick={() => handleDelete(selected)}
            className="delete-field-btn"
            title="Удалить подключение"
          >
            ✖
          </button>
        )}
      </div>

      {/* Добавление нового подключения */}
      <input
        type="text"
        placeholder="Название подключения (например: NeonProd)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="p-2 rounded bg-[#101a33] border border-[#233861] text-sm text-gray-200 mb-2"
      />

      <input
        type="text"
        placeholder="postgresql://user:password@host/db"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="p-2 rounded bg-[#101a33] border border-[#233861] text-sm text-gray-200 mb-3"
      />

      <button
        onClick={handleAdd}
        className="add-btn self-start"
        title="Сохранить подключение"
      >
        💾 Сохранить
      </button>
    </div>
  );
}

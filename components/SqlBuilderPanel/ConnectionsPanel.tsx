import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { PanelWrapper } from "../ui/PanelWrapper";

interface Connection {
  name: string;
  url: string;
}

interface Props {
  onSelect: (url: string) => void;
  onRefreshSchema?: () => void;
  loading?: boolean;
}

const STORAGE_KEY = "savedConnections";

export default function ConnectionsPanel({
  onSelect,
  onRefreshSchema,
  loading,
}: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  // Загружаем сохранённые подключения
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

  const saveConnections = (list: Connection[]) => {
    setConnections(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const handleAdd = () => {
    if (!name.trim() || !url.trim()) {
      alert("Введите имя и URL подключения!");
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

  const handleDelete = (target: string) => {
    const updated = connections.filter((c) => c.name !== target);
    saveConnections(updated);
    if (selected === target) {
      setSelected("");
      onSelect("");
    }
  };

  const handleConnect = () => {
    const found = connections.find((c) => c.name === selected);
    if (found) onSelect(found.url);
    else alert("Выберите подключение!");
  };

  return (
    <PanelWrapper title="🔗 Подключение к базе данных">
      {/* Сохранённые подключения */}
      <div className="input-group">
        <label className="sql-label">Сохранённые подключения</label>
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="sql-input flex-1"
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
              className="delete-field-btn text-red-400 hover:text-red-300"
              title="Удалить подключение"
            >
              ✖
            </button>
          )}
        </div>
      </div>

      {/* Добавление нового подключения */}
      <div className="input-group mt-5">
        <label className="sql-label">Добавить новое подключение</label>
        <input
          type="text"
          placeholder="Название подключения"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="sql-input"
        />
        <input
          type="text"
          placeholder="postgresql://user:password@host/db"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="sql-input"
        />

        <Button
          onClick={handleAdd}
          className="w-full py-2 mt-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-medium shadow-md hover:shadow-cyan-500/30 hover:brightness-110 transition-all"
        >
          💾 Сохранить подключение
        </Button>
      </div>

      {/* Нижняя панель */}
      <div className="flex flex-wrap justify-between items-center mt-8 gap-3 border-t border-zinc-800 pt-4">
        <Button
          onClick={handleConnect}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium px-5 py-2 rounded-xl shadow-md hover:shadow-emerald-400/30 hover:brightness-110 transition-all"
        >
          🔌 Подключиться
        </Button>

        {onRefreshSchema && (
          <Button
            onClick={onRefreshSchema}
            disabled={loading}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium px-5 py-2 rounded-xl shadow-md hover:shadow-indigo-400/30 hover:brightness-110 transition-all disabled:opacity-50"
          >
            🔄 {loading ? "Обновление..." : "Обновить схему"}
          </Button>
        )}
      </div>
    </PanelWrapper>
  );
}

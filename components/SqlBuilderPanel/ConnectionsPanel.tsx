import React, { useState, useEffect } from "react";

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

  // Загрузка подключений из localStorage
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

  // Сохранение подключений
  const saveConnections = (list: Connection[]) => {
    setConnections(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  // Добавление нового подключения
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

  // Удаление подключения
  const handleDelete = (target: string) => {
    const updated = connections.filter((c) => c.name !== target);
    saveConnections(updated);
    if (selected === target) {
      setSelected("");
      onSelect("");
    }
  };

  // Подключение
  const handleConnect = () => {
    const found = connections.find((c) => c.name === selected);
    if (found) {
      onSelect(found.url);
    } else {
      alert("Выберите подключение!");
    }
  };

  return (
    <div className="connections-panel unified">
      <h3>🔗 Подключение к базе данных</h3>

      {/* Список подключений */}
      <div className="input-row">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
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
            className="delete-btn"
            title="Удалить подключение"
          >
            ✖
          </button>
        )}
      </div>

      {/* Добавление нового подключения */}
      <div className="input-row">
        <input
          type="text"
          placeholder="Название подключения"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="input-row">
        <input
          type="text"
          placeholder="postgresql://user:password@host/db"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      {/* Кнопки действий */}
      <div className="flex-between">
        <button onClick={handleAdd} className="action-btn save">
          💾 Сохранить
        </button>
        <button onClick={handleConnect} className="action-btn connect">
          🔌 Подключиться
        </button>
        {onRefreshSchema && (
          <button
            onClick={onRefreshSchema}
            disabled={loading}
            className="action-btn refresh"
          >
            🔄 {loading ? "Обновление..." : "Обновить схему"}
          </button>
        )}
      </div>
    </div>
  );
}

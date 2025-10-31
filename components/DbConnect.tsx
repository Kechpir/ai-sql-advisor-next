import { useState } from 'react';
import { fetchSchema, fetchLocalSchema } from '../lib/api';
import SqlDialectSelect from './SqlDialectSelect';

export default function DbConnect({
  onLoaded,
  onToast,
}: {
  onLoaded: (schema: any, dialect: string) => void;
  onToast?: (type: 'ok' | 'warn' | 'err', text: string) => void;
}) {
  const [dbUrl, setDbUrl] = useState('');
  const [localDbUrl, setLocalDbUrl] = useState('');
  const [schemaName, setSchemaName] = useState('public');
  const [loading, setLoading] = useState(false);
  const [dialect, setDialect] = useState('postgres');

  const handleFetch = async () => {
    if (!dbUrl.trim() && !localDbUrl.trim())
      return onToast?.('warn', 'Введите адрес подключения к БД');

    setLoading(true);
    try {
      const data = localDbUrl
        ? await fetchLocalSchema(localDbUrl, schemaName)
        : await fetchSchema(dbUrl, schemaName);
      onLoaded(data, dialect);
      onToast?.('ok', `✅ Схема успешно загружена (${dialect})`);
    } catch (e) {
      console.error('fetch_schema error', e);
      onToast?.('err', 'Ошибка при загрузке схемы');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: '#0b1220',
    color: '#e5e7eb',
    border: '1px solid #1f2937',
    borderRadius: 12,
    padding: '10px 12px',
    width: '100%',
  } as const;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <input
        placeholder="postgresql://user:pass@host/db?sslmode=require"
        value={dbUrl}
        onChange={(e) => setDbUrl(e.target.value)}
        style={inputStyle}
      />

      <input
        placeholder="file:/path/to/db.sqlite или postgresql://localhost:5432/mydb"
        value={localDbUrl}
        onChange={(e) => setLocalDbUrl(e.target.value)}
        style={inputStyle}
      />
      <small style={{ color: '#9ca3af', marginTop: '-4px' }}>
        🔌 Подключение к локальной базе (опционально)
      </small>

      <input
        placeholder="public"
        value={schemaName}
        onChange={(e) => setSchemaName(e.target.value)}
        style={inputStyle}
      />

      <SqlDialectSelect value={dialect} onChange={setDialect} />

      <button
        onClick={handleFetch}
        disabled={loading}
        style={{
          background: 'linear-gradient(90deg,#90deg,#22d3ee,#3b82f6)',
          color: '#0b1220',
          fontWeight: 700,
          border: 'none',
          borderRadius: 12,
          padding: '10px 14px',
          cursor: 'pointer',
        }}
      >
        {loading ? '⏳ Загрузка схемы...' : '🔍 Загрузить схему'}
      </button>
    </div>
  );
}

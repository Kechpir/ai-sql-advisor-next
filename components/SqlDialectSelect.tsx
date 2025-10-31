import { useEffect, useState } from 'react';

const DIALECTS = [
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'mssql', label: 'SQL Server' },
  { value: 'oracle', label: 'Oracle SQL' },
  { value: 'snowflake', label: 'Snowflake' },
  { value: 'bigquery', label: 'BigQuery' },
  { value: 'redshift', label: 'Amazon Redshift' },
];

export default function SqlDialectSelect({
  value,
  onChange,
}: {
  value?: string;
  onChange: (val: string) => void;
}) {
  const [selected, setSelected] = useState<string>(value || '');

  useEffect(() => {
    const saved = localStorage.getItem('preferred_dialect');
    if (saved && !value) setSelected(saved);
  }, []);

  const handleChange = (val: string) => {
    setSelected(val);
    onChange(val);
    localStorage.setItem('preferred_dialect', val);
  };

  return (
    <div style={{ position: 'relative' }}>
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          background: '#0b1220',
          color: selected ? '#e5e7eb' : '#6b7280',
          border: '1px solid #1f2937',
          borderRadius: 12,
          padding: '10px 12px',
          width: '100%',
          appearance: 'none',
          fontWeight: 500,
        }}
      >
        <option value="" disabled>
          Выберите SQL-диалект
        </option>
        {DIALECTS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>

      {/* Стрелочка — теперь ровная и красивая */}
      <span
        style={{
          position: 'absolute',
          right: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#9ca3af',
          pointerEvents: 'none',
        }}
      >
        ▼
      </span>
    </div>
  );
}

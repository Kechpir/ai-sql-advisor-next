#!/usr/bin/env bash
set -euo pipefail

# 1) Пишем компонент целиком (без обрыва heredoc)
mkdir -p components
cat > components/SqlResult.tsx <<'TSX'
import React, { useMemo } from "react";

type Props = { sql: string | null };

const DANGER_RE = /\b(DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|DELETE|UPDATE|INSERT|MERGE)\b/i;

export default function SqlResult({ sql }: Props) {
  const danger = useMemo(() => !!(sql && DANGER_RE.test(sql)), [sql]);
  if (!sql) return null;

  const normalized = (s: string) => (s.trim().endsWith(";") ? s.trim() : s.trim() + ";");

  const variantPlain = [
    `-- ⚠ ВНИМАНИЕ: Запрос содержит потенциально опасные операции:`,
    `-- Рекомендуется выполнять в транзакции с точкой отката.`,
    `-- Пример последовательности:`,
    `-- BEGIN;`,
    `-- SAVEPOINT ai_guard;`,
    normalized(sql),
    `-- ROLLBACK TO SAVEPOINT ai_guard;  -- если нужно отменить`,
    `-- COMMIT;  -- когда уверены в результате`,
  ].join("\n");

  const savepointName = "user_guard";
  const variantSavepoint = [
    `BEGIN;`,
    `SAVEPOINT ${savepointName};`,
    ``,
    `-- ⚠ ВНИМАНИЕ: Запрос содержит потенциально опасные операции:`,
    normalized(sql),
    ``,
    `-- если что-то пошло не так:`,
    `ROLLBACK TO SAVEPOINT ${savepointName};`,
    `COMMIT;`,
  ].join("\n");

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  return (
    <div style={{display:"grid", gap:12, marginTop:16}}>
      {danger && (
        <div style={{
          border:"1px solid #ef444460",
          background:"#ef444420",
          color:"#e5e7eb",
          padding:"10px 12px",
          borderRadius:10
        }}>
          <b style={{color:"#ffb4b4"}}>ВНИМАНИЕ:</b> Запрос содержит потенциально опасные операции
          (<b>DROP/ALTER/TRUNCATE/CREATE/GRANT/REVOKE/DELETE/UPDATE/INSERT/MERGE</b>).
          Проверьте условия, права и резервные копии перед выполнением.
        </div>
      )}

      <Block title="Обычный вариант" code={variantPlain} onCopy={() => copy(variantPlain)} />
      <Block title="Вариант с SAVEPOINT (рекомендуется для опасных операций)" code={variantSavepoint} onCopy={() => copy(variantSavepoint)} />
    </div>
  );
}

function Block({ title, code, onCopy }: {title:string; code:string; onCopy:()=>void}) {
  return (
    <div style={{border:"1px solid #1f2937", borderRadius:12, background:"#0f172a"}}>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px"}}>
        <div style={{color:"#e5e7eb", fontWeight:700}}>{title}</div>
        <button onClick={onCopy} style={{
          background:"#0b1220", color:"#e5e7eb",
          border:"1px solid #1f2937", borderRadius:10, padding:"6px 10px", cursor:"pointer"
        }}>Скопировать</button>
      </div>
      <pre style={{
        whiteSpace:"pre-wrap",
        margin:0,
        background:"#0b1220",
        borderTop:"1px solid #1f2937",
        borderRadius:"0 0 12px 12px",
        padding:12,
        color:"#e5e7eb",
        fontSize:13
      }}>{code}</pre>
    </div>
  );
}
TSX

# 2) Импорт компонента на странице (если ещё не импортирован)
if ! grep -q 'import SqlResult from "@/components/SqlResult";' pages/index.tsx 2>/dev/null; then
  sed -i '1i import SqlResult from "@/components/SqlResult";' pages/index.tsx
fi

# 3) Заменяем вывод сырого <pre>{generatedSql}</pre> на <SqlResult sql={generatedSql} />
perl -0777 -pe 's/\{generatedSql\s*&&\s*<pre[^>]*>\s*\{generatedSql\}\s*<\/pre>\}/\{generatedSql && <SqlResult sql=\{generatedSql\} \/\>\}/s' -i pages/index.tsx

echo "✅ SqlResult.tsx восстановлен и подключён."

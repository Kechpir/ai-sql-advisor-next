import { useState } from 'react'
import DbConnect from './components/DbConnect'
import { generateSql } from '../lib/api'

function annotate(sql: string) {
  const up = sql.toUpperCase()
  const notes:string[] = []
  if (up.includes('SELECT'))   notes.push('-- SELECT: какие колонки выводим и почему')
  if (up.includes('FROM'))     notes.push('-- FROM: основная таблица/представление источника данных')
  if (up.includes('JOIN'))     notes.push('-- JOIN: связываем таблицы по ключам, чтобы не потерять строки')
  if (up.includes('WHERE'))    notes.push('-- WHERE: фильтрация — оставляем только нужные строки')
  if (up.includes('GROUP BY')) notes.push('-- GROUP BY: группируем по ключам агрегирования')
  if (up.includes('ORDER BY')) notes.push('-- ORDER BY: итоговая сортировка для удобного чтения')
  if (up.includes('COALESCE('))notes.push('-- COALESCE: заменяем NULL на значение по умолчанию')
  if (up.includes('COUNT('))   notes.push('-- COUNT: считаем строки, COUNT(*) — все, COUNT(col) — только не-NULL')
  return notes.length ? `/* Пояснения:\n${notes.join('\n')}\n*/\n` + sql : sql
}

const DANGEROUS_RE = /\b(DELETE|UPDATE|INSERT|ALTER|DROP|TRUNCATE|MERGE|CREATE|REPLACE)\b/i
const isDangerous = (sql:string) => DANGEROUS_RE.test(sql)

function wrapWithTransaction(sql: string) {
  const body = sql.trim().replace(/;?\s*$/, ';')
  return [
    'BEGIN TRANSACTION;',
    'SAVEPOINT ai_guard; -- точка отката',
    '',
    '-- ваши операции ниже:',
    body,
    '',
    '-- при необходимости можно откатить:',
    '-- ROLLBACK TO SAVEPOINT ai_guard;',
    'COMMIT;'
  ].join('\n')
}

export default function Home() {
  const [tab, setTab] = useState<'scan'|'saved'>('scan')
  const [schemaJson, setSchemaJson] = useState<any | null>(null)
  const [nl, setNl] = useState('')
  const [generatedSql, setGeneratedSql] = useState<string | null>(null)
  const [wrappedSql, setWrappedSql] = useState<string | null>(null)
  const [explain, setExplain] = useState(false)
  const [loadingGen, setLoadingGen] = useState(false)
  const [isDanger, setIsDanger] = useState(false)

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); alert('Скопировано ✅') }
    catch { alert('Не удалось скопировать') }
  }

  const onGenerate = async () => {
    if (!schemaJson) return alert('Сначала загрузите схему.')
    if (!nl.trim())  return alert('Введите текст задачи.')
    setLoadingGen(true)
    try {
      const data = await generateSql(nl.trim(), schemaJson, 'postgres')
      if (data.blocked) {
        alert('🚫 Запрос заблокирован: ' + (data.reason || 'policy'))
        setGeneratedSql(null); setWrappedSql(null); setIsDanger(false)
        return
      }
      const raw = String(data.sql || '')
      const danger = isDangerous(raw)
      setIsDanger(danger)

      const base = explain ? annotate(raw) : raw
      const wrapped = explain ? annotate(wrapWithTransaction(raw)) : wrapWithTransaction(raw)

      setGeneratedSql(base)
      setWrappedSql(danger ? wrapped : null)
    } catch (e:any) {
      alert('Ошибка генерации: ' + e.message)
    } finally {
      setLoadingGen(false)
    }
  }

  const Code = ({children}:{children:string}) => (
    <pre style={{
      background:'#0b1220', border:'1px solid #1f2937', borderRadius:12,
      padding:'12px', whiteSpace:'pre-wrap', fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize:13, lineHeight:1.5
    }}>{children}</pre>
  )

  return (
    <div>
      <div className="page-wrap">
        <h1 style={{margin:0}}>🧠 AI SQL Advisor</h1>
        <p style={{margin:'6px 0 20px',opacity:.8}}>Генерация корректного SQL. Только SELECT, без выполнения.</p>

        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <button onClick={()=>setTab('scan')}
            style={{padding:'10px 14px',borderRadius:12,border:'1px solid #1f2937',
                    background:tab==='scan'?'#111827':'#0f172a',color:'#e5e7eb',cursor:'pointer'}}>
            🔎 Сканировать
          </button>
          <button onClick={()=>setTab('saved')}
            style={{padding:'10px 14px',borderRadius:12,border:'1px solid #1f2937',
                    background:tab==='saved'?'#111827':'#0f172a',color:'#e5e7eb',cursor:'pointer'}}>
            💾 Сохранённые базы
          </button>
        </div>

        {tab==='scan' && (
          <div style={{border:'1px solid #1f2937',borderRadius:12,padding:16,background:'#0f172a'}}>
            <h3 style={{marginTop:0}}>Подключение и загрузка схемы</h3>
            <DbConnect onLoaded={(s)=>{ setSchemaJson(s); setGeneratedSql(null); setWrappedSql(null); setIsDanger(false) }} />

            {schemaJson && (
              <>
                <div style={{marginTop:12}}>
                  <span style={{background:'#10b98120', color:'#065f46', padding:'4px 10px', borderRadius:999, fontSize:12, border:'1px solid #10b98150'}}>
                    Схема загружена • таблиц: {schemaJson.countTables ?? Object.keys(schemaJson.tables||{}).length}
                  </span>
                </div>
                <details style={{marginTop:10}}>
                  <summary>Показать JSON-схему</summary>
                  <Code>{JSON.stringify(schemaJson, null, 2)}</Code>
                </details>
              </>
            )}

            <hr style={{borderColor:'#1f2937', margin:'20px 0'}}/>

            <h3>Генерация SQL</h3>
            <textarea
              placeholder="Например: 'Покажи имена и email клиентов...'"
              value={nl}
              onChange={e=>setNl(e.target.value)}
              rows={5}
            />

            <div style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:10,fontSize:14,opacity:.9}}>
              <input id="explain" type="checkbox" checked={explain} onChange={e=>setExplain(e.target.checked)} />
              <label htmlFor="explain" style={{cursor:'pointer'}}>Пояснить SQL</label>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10}}>
              <button onClick={onGenerate} disabled={loadingGen}
                style={{background:'linear-gradient(90deg, #22d3ee, #3b82f6)', color:'#0b1220', fontWeight:700, border:'none', borderRadius:12, padding:'10px 14px', cursor:'pointer'}}>
                {loadingGen ? '⏳ Генерируем…' : 'Сгенерировать SQL'}
              </button>
              <button
                onClick={()=>{ setGeneratedSql(null); setWrappedSql(null); setIsDanger(false); setNl('') }}
                style={{background:'#0b1220', color:'#e5e7eb', border:'1px solid #1f2937', borderRadius:12, padding:'10px 14px', cursor:'pointer'}}
              >Очистить</button>
            </div>

            {isDanger && (
              <div style={{marginTop:16, border:'1px solid #f59e0b55', background:'#f59e0b10', borderRadius:12, padding:'12px'}}>
                <b style={{color:'#fbbf24'}}>Внимание:</b> запрос меняет данные/схему. Лучше запускать <i>в транзакции с SAVEPOINT/ROLLBACK</i>. Ниже — два варианта.
              </div>
            )}

            {generatedSql && (
              <div style={{marginTop:16}}>
                <h3 style={{marginTop:0}}>Результат</h3>

                {isDanger && wrappedSql ? (
                  <>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <h4 style={{margin:'8px 0 6px'}}>Вариант A — в транзакции (рекомендуется)</h4>
                      <button onClick={()=>copy(wrappedSql!)} style={{border:'1px solid #334155',background:'#0b1220',color:'#e5e7eb',borderRadius:10,padding:'6px 10px',cursor:'pointer'}}>Скопировать</button>
                    </div>
                    <Code>{wrappedSql}</Code>

                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center', marginTop:10}}>
                      <h4 style={{margin:'8px 0 6px'}}>Вариант B — без транзакции</h4>
                      <button onClick={()=>copy(generatedSql!)} style={{border:'1px solid #334155',background:'#0b1220',color:'#e5e7eb',borderRadius:10,padding:'6px 10px',cursor:'pointer'}}>Скопировать</button>
                    </div>
                    <Code>{generatedSql}</Code>
                  </>
                ) : (
                  <>
                    <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center'}}>
                      <button onClick={()=>copy(generatedSql!)} style={{border:'1px solid #334155',background:'#0b1220',color:'#e5e7eb',borderRadius:10,padding:'6px 10px',cursor:'pointer'}}>Скопировать</button>
                    </div>
                    <Code>{generatedSql}</Code>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {tab==='saved' && (
          <div style={{border:'1px solid #1f2937',borderRadius:12,padding:16,background:'#0f172a'}}>
            <p style={{marginTop:0, opacity:.8}}>Здесь будет список сохранённых схем (bucket: <code>schemas</code>).</p>
          </div>
        )}
      </div>
    </div>
  )
}

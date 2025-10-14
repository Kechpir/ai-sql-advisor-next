import { useState } from 'react'
import DbConnect from './components/DbConnect'
import { generateSql } from '../lib/api'

function annotate(sql: string) {
  const up = sql.toUpperCase()
  const notes:string[] = []
  if (up.includes('SELECT'))   notes.push('-- SELECT: какие колонки выводим')
  if (up.includes('FROM'))     notes.push('-- FROM: из какой таблицы берём')
  if (up.includes('JOIN'))     notes.push('-- JOIN: соединяем таблицы')
  if (up.includes('WHERE'))    notes.push('-- WHERE: фильтрация строк')
  if (up.includes('GROUP BY')) notes.push('-- GROUP BY: группировка')
  if (up.includes('ORDER BY')) notes.push('-- ORDER BY: сортировка')
  if (up.includes('COALESCE('))notes.push('-- COALESCE: замена NULL на значение')
  if (up.includes('COUNT('))   notes.push('-- COUNT: COUNT(*) считает все строки')
  return notes.length ? `/* Пояснения:\n${notes.join('\n')}\n*/\n` + sql : sql
}

export default function Home() {
  const [tab, setTab] = useState<'scan'|'saved'>('scan')
  const [schemaJson, setSchemaJson] = useState<any | null>(null)
  const [nl, setNl] = useState('')
  const [generatedSql, setGeneratedSql] = useState<string | null>(null)
  const [explain, setExplain] = useState(false)
  const [loadingGen, setLoadingGen] = useState(false)

  const onGenerate = async () => {
    if (!schemaJson) return alert('Сначала загрузите схему.')
    if (!nl.trim())  return alert('Введите текст задачи.')
    setLoadingGen(true)
    try {
      const data = await generateSql(nl.trim(), schemaJson, 'postgres')
      if (data.blocked) {
        alert('🚫 Запрос заблокирован: ' + (data.reason || 'policy'))
        setGeneratedSql(null)
      } else {
        const sql = String(data.sql || '')
        setGeneratedSql(explain ? annotate(sql) : sql)
      }
    } catch (e:any) {
      alert('Ошибка генерации: ' + e.message)
    } finally {
      setLoadingGen(false)
    }
  }

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
            <DbConnect onLoaded={(s)=>setSchemaJson(s)} />

            {schemaJson && (
              <>
                <div style={{marginTop:12}}>
                  <span style={{background:'#10b98120', color:'#065f46', padding:'4px 10px', borderRadius:999, fontSize:12, border:'1px solid #10b98150'}}>
                    Схема загружена • таблиц: {schemaJson.countTables ?? Object.keys(schemaJson.tables||{}).length}
                  </span>
                </div>
                <details style={{marginTop:10}}>
                  <summary>Показать JSON-схему</summary>
                  <pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(schemaJson, null, 2)}</pre>
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

            {/* Компактный чекбокс справа от текстового поля */}
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10}}>
              <div style={{height:1}} />
              <label style={{display:'inline-flex',alignItems:'center',gap:8,fontSize:14,opacity:.9,cursor:'pointer'}}>
                <input type="checkbox" checked={explain} onChange={e=>setExplain(e.target.checked)} />
                Пояснить SQL
              </label>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10}}>
              <button onClick={onGenerate} disabled={loadingGen}
                style={{height:44, background:'linear-gradient(90deg, #22d3ee, #3b82f6)', color:'#0b1220', fontWeight:700, border:'none', borderRadius:12, padding:'0 14px', cursor:'pointer'}}>
                {loadingGen ? 'Генерируем…' : 'Сгенерировать SQL'}
              </button>
              <button
                onClick={()=>{ setGeneratedSql(null); setNl('') }}
                style={{height:44, background:'#0b1220', color:'#e5e7eb', border:'1px solid #1f2937', borderRadius:12, padding:'0 14px', cursor:'pointer'}}
              >Очистить</button>
            </div>

            {generatedSql && (
              <div style={{marginTop:16}}>
                <h3 style={{marginTop:0}}>Результат</h3>
                <pre style={{background:'#0b1220', border:'1px solid #1f2937', borderRadius:12, padding:'12px', whiteSpace:'pre-wrap'}}>{generatedSql}</pre>
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

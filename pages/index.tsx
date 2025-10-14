import { useState } from 'react'
import DbConnect from './components/DbConnect'
import SchemasManager from './components/SchemasManager'
import { generateSql, saveSchema } from '../lib/api'

function annotate(sql: string) {
  const up = sql.toUpperCase()
  const notes:string[] = []
  if (up.includes('SELECT'))   notes.push('-- SELECT: какие колонки выводим и зачем')
  if (up.includes('FROM'))     notes.push('-- FROM: источник данных — таблица или представление')
  if (up.includes('JOIN'))     notes.push('-- JOIN: связываем таблицы, чтобы получить связанные поля')
  if (up.includes('WHERE'))    notes.push('-- WHERE: фильтруем строки по условию')
  if (up.includes('GROUP BY')) notes.push('-- GROUP BY: группируем результаты')
  if (up.includes('ORDER BY')) notes.push('-- ORDER BY: сортируем итог')
  return notes.length ? `/* Пояснения:\n${notes.join('\n')}\n*/\n` + sql : sql
}

export default function Home() {
  const [tab, setTab] = useState<'scan'|'saved'>('scan')
  const [schemaJson, setSchemaJson] = useState<any|null>(null)
  const [nl, setNl] = useState('')
  const [generatedSql, setGeneratedSql] = useState<string|null>(null)
  const [explain, setExplain] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saveName, setSaveName] = useState('')

  const onGenerate = async () => {
    if (!schemaJson) return alert('Сначала загрузите схему.')
    if (!nl.trim()) return alert('Введите задачу.')
    setLoading(true)
    try {
      const data = await generateSql(nl.trim(), schemaJson, 'postgres')
      if (data.blocked) return alert('🚫 Запрос заблокирован: '+data.reason)
      const sql = String(data.sql || '')
      setGeneratedSql(explain ? annotate(sql) : sql)
    } catch (e:any) { alert('Ошибка: '+e.message) }
    finally { setLoading(false) }
  }

  const onSave = async () => {
    if (!schemaJson) return alert('Нет схемы для сохранения')
    if (!saveName.trim()) return alert('Введите имя')
    try { 
      await saveSchema(saveName.trim(), schemaJson)
      alert(`✅ Схема «${saveName.trim()}» сохранена`)
      setSaveName('')
    } catch (e:any) { alert('Ошибка: '+e.message) }
  }

  return (
    <div>
      <div className="page-wrap">
        <h1 style={{margin:0}}>🧠 AI SQL Advisor</h1>
        <p style={{margin:'6px 0 20px',opacity:.8}}>Генерация SQL и управление схемами.</p>

        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <button onClick={()=>setTab('scan')} style={tabBtn(tab==='scan')}>🔎 Сканировать</button>
          <button onClick={()=>setTab('saved')} style={tabBtn(tab==='saved')}>💾 Сохранённые базы</button>
        </div>

        {tab==='scan' && (
          <div style={block}>
            <h3>Подключение и загрузка схемы</h3>
            <DbConnect onLoaded={setSchemaJson}/>

            {schemaJson && (
              <>
                <div style={{marginTop:12}}>
                  <span style={badge}>
                    Схема загружена • таблиц: {schemaJson.countTables ?? Object.keys(schemaJson.tables||{}).length}
                  </span>
                </div>
                <details style={{marginTop:10}}>
                  <summary>Показать JSON-схему</summary>
                  <pre style={pre}>{JSON.stringify(schemaJson, null, 2)}</pre>
                </details>

                <div style={{marginTop:14,display:'flex',gap:8}}>
                  <input
                    placeholder="например: neon_demo"
                    value={saveName}
                    onChange={e=>setSaveName(e.target.value)}
                    style={input}
                  />
                  <button onClick={onSave} style={btnMain}>💾 Сохранить</button>
                </div>
              </>
            )}

            <hr style={{borderColor:'#1f2937',margin:'20px 0'}}/>

            <h3>Генерация SQL</h3>
            <textarea
              placeholder="Например: 'Покажи имена и email клиентов...'"
              value={nl}
              onChange={e=>setNl(e.target.value)}
              rows={5}
              style={input}
            />
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10,fontSize:14,opacity:.9}}>
              <input id="explain" type="checkbox" checked={explain} onChange={e=>setExplain(e.target.checked)} />
              <label htmlFor="explain">Пояснить SQL</label>
            </div>
            <div style={{display:'flex',gap:8,marginTop:10}}>
              <button onClick={onGenerate} disabled={loading} style={btnMain}>
                {loading ? '⏳ Генерируем…' : 'Сгенерировать'}
              </button>
              <button onClick={()=>{setGeneratedSql(null);setNl('')}} style={btnSec}>Очистить</button>
            </div>
            {generatedSql && <pre style={{...pre,marginTop:16}}>{generatedSql}</pre>}
          </div>
        )}

        {tab==='saved' && <div style={block}><SchemasManager schemaJson={schemaJson} setSchemaJson={setSchemaJson}/></div>}
      </div>
    </div>
  )
}

const tabBtn=(active:boolean)=>({
  padding:'10px 14px',borderRadius:12,border:'1px solid #1f2937',
  background:active?'#111827':'#0f172a',color:'#e5e7eb',cursor:'pointer'
})
const block={border:'1px solid #1f2937',borderRadius:12,padding:16,background:'#0f172a'}
const input={background:'#0b1220',color:'#e5e7eb',border:'1px solid #1f2937',borderRadius:12,padding:'10px 12px',flex:1}
const btnMain={background:'linear-gradient(90deg,#22d3ee,#3b82f6)',color:'#0b1220',fontWeight:700,border:'none',borderRadius:12,padding:'10px 14px',cursor:'pointer'}
const btnSec={background:'#0b1220',color:'#e5e7eb',border:'1px solid #1f2937',borderRadius:12,padding:'10px 14px',cursor:'pointer'}
const badge={background:'#10b98120',color:'#065f46',padding:'4px 10px',borderRadius:999,fontSize:12,border:'1px solid #10b98150'}
const pre={whiteSpace:'pre-wrap',background:'#0b1220',border:'1px solid #1f2937',borderRadius:12,padding:12,fontSize:13}

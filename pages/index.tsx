import { useState } from 'react'
import DbConnect from './components/DbConnect'

export default function Home() {
  const [tab, setTab] = useState<'scan'|'saved'>('scan')
  const [schemaJson, setSchemaJson] = useState<any | null>(null)
  const [nl, setNl] = useState('')
  const [generatedSql, setGeneratedSql] = useState<string | null>(null)

  return (
    <div style={{minHeight:'100vh',background:'radial-gradient(1200px 600px at 10% 10%, rgba(56,189,248,.08), transparent 40%), radial-gradient(1000px 500px at 90% 20%, rgba(99,102,241,.10), transparent 42%), linear-gradient(180deg, #0b1220 0%, #0b1220 100%)',color:'#e2e8f0',fontFamily:'Inter,system-ui,Segoe UI,Roboto,Arial'}}>
      <div style={{maxWidth:880,margin:'0 auto',padding:'64px 16px'}}>
        <h1 style={{margin:0}}>🧠 AI SQL Advisor</h1>
        <p style={{margin:'6px 0 20px',opacity:.8}}>Генерация корректного SQL. Только SELECT, без выполнения.</p>

        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <button onClick={()=>setTab('scan')}  style={{padding:'10px 14px',borderRadius:12,border:'1px solid #1f2937',background:tab==='scan'?'#111827':'#0f172a',color:'#e5e7eb',cursor:'pointer'}}>🔎 Сканировать/Генерировать</button>
          <button onClick={()=>setTab('saved')} style={{padding:'10px 14px',borderRadius:12,border:'1px solid #1f2937',background:tab==='saved'?'#111827':'#0f172a',color:'#e5e7eb',cursor:'pointer'}}>💾 Сохранённые базы</button>
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
              style={{width:'100%', background:'#0b1220', color:'#e5e7eb', border:'1px solid #1f2937', borderRadius:12, padding:'10px 12px'}}
            />
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10}}>
              <button
                onClick={()=>{ setGeneratedSql('SELECT * FROM customers LIMIT 10;') /* заглушка, подключим /generate_sql */}}
                style={{background:'linear-gradient(90deg, #22d3ee, #3b82f6)', color:'#0b1220', fontWeight:700, border:'none', borderRadius:12, padding:'10px 14px', cursor:'pointer'}}
              >🤖 Сгенерировать SQL</button>
              <button
                onClick={()=>{ setGeneratedSql(null); setNl('') }}
                style={{background:'#0b1220', color:'#e5e7eb', border:'1px solid #1f2937', borderRadius:12, padding:'10px 14px', cursor:'pointer'}}
              >🧹 Очистить</button>
            </div>

            {generatedSql && (
              <div style={{marginTop:16}}>
                <h3 style={{marginTop:0}}>Результат</h3>
                <pre style={{background:'#0b1220', border:'1px solid #1f2937', borderRadius:12, padding:'12px'}}>{generatedSql}</pre>
              </div>
            )}
          </div>
        )}

        {tab==='saved' && (
          <div style={{border:'1px solid #1f2937',borderRadius:12,padding:16,background:'#0f172a'}}>
            <p style={{marginTop:0, opacity:.8}}>Здесь будет список сохранённых схем (bucket: <code>schemas</code>). Подключим после RLS.</p>
          </div>
        )}
      </div>
    </div>
  )
}

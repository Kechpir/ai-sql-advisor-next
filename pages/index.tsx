import { useState } from 'react'

export default function Home() {
  const [tab, setTab] = useState<'scan'|'saved'>('scan')
  return (
    <div style={{minHeight:'100vh',background:'#0b1220',color:'#e2e8f0',fontFamily:'Inter,system-ui,Segoe UI,Roboto,Arial'}}>
      <div style={{maxWidth:880,margin:'0 auto',padding:'64px 16px'}}>
        <h1 style={{margin:0}}>🧠 AI SQL Advisor</h1>
        <p style={{margin:'6px 0 20px',opacity:.8}}>Генерация корректного SQL. Только SELECT, без выполнения.</p>

        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <button onClick={()=>setTab('scan')}  style={{padding:'10px 14px',borderRadius:12,border:'1px solid #1f2937',background:tab==='scan'?'#111827':'#0f172a',color:'#e5e7eb',cursor:'pointer'}}>🔎 Сканировать/Генерировать</button>
          <button onClick={()=>setTab('saved')} style={{padding:'10px 14px',borderRadius:12,border:'1px solid #1f2937',background:tab==='saved'?'#111827':'#0f172a',color:'#e5e7eb',cursor:'pointer'}}>💾 Сохранённые базы</button>
        </div>

        {tab==='scan'  && <div id="scan"  style={{border:'1px solid #1f2937',borderRadius:12,padding:16,background:'#0f172a'}}>Здесь будет форма подключения и генерация SQL.</div>}
        {tab==='saved' && <div id="saved" style={{border:'1px solid #1f2937',borderRadius:12,padding:16,background:'#0f172a'}}>Здесь будет список сохранённых схем.</div>}
      </div>
    </div>
  )
}

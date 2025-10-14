import { useState } from 'react'
import { fetchSchema } from '../../lib/api'

export default function DbConnect({
  onLoaded,
  onToast,
}: {
  onLoaded: (schema: any) => void
  onToast?: (type: 'ok' | 'warn' | 'err', text: string) => void
}) {
  const [dbUrl, setDbUrl] = useState('')
  const [schemaName, setSchemaName] = useState('public')
  const [loading, setLoading] = useState(false)

  const handleFetch = async () => {
    if (!dbUrl.trim()) return onToast?.('warn', 'Введите строку подключения')
    setLoading(true)
    try {
      const data = await fetchSchema(dbUrl, schemaName)
      onLoaded(data)
      onToast?.('ok', 'Схема загружена ✅')
    } catch (e) {
      console.error('fetch_schema error', e)
      onToast?.('err', 'Ошибка загрузки схемы')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {background:'#0b1220',color:'#e5e7eb',border:'1px solid #1f2937',borderRadius:12,padding:'10px 12px'} as const

  return (
    <div style={{display:'grid',gap:10}}>
      <input placeholder="postgresql://user:pass@host/db?sslmode=require"
        value={dbUrl} onChange={e=>setDbUrl(e.target.value)} style={inputStyle} />
      <input placeholder="public" value={schemaName}
        onChange={e=>setSchemaName(e.target.value)} style={inputStyle} />
      <button onClick={handleFetch} disabled={loading}
        style={{background:'linear-gradient(90deg,#22d3ee,#3b82f6)',color:'#0b1220',fontWeight:700,border:'none',borderRadius:12,padding:'10px 14px',cursor:'pointer'}}>
        {loading?'⏳ Загрузка...':'🔎 Загрузить схему'}
      </button>
    </div>
  )
}

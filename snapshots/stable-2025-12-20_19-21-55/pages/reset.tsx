import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function ResetPassword() {
  const router = useRouter()
  const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const [token, setToken] = useState<string | null>(null)
  const [pass1, setPass1] = useState('')
  const [pass2, setPass2] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const th = q.get('token_hash') || h.get('token_hash')
    const t  = (q.get('type') || h.get('type') || '').toLowerCase()
    if (t === 'recovery' && th) setToken(th)
  }, [])

  async function handleReset() {
    if (!token) return setMsg('⚠️ Ссылка недействительна или устарела.')
    if (!pass1 || pass1 !== pass2) return setMsg('Пароли не совпадают.')
    setLoading(true); setMsg('')
    try {
      // 1) Обмен token_hash -> access_token
      const r = await fetch(`${SUPA}/auth/v1/verify`, {
        method: 'POST',
        headers: {'Content-Type':'application/json','apikey':ANON,'Authorization':`Bearer ${ANON}`},
        body: JSON.stringify({ type: 'recovery', token_hash: token }),
      })
      const j = await r.json().catch(()=> ({}))
      if (!r.ok) throw new Error(j.error_description || j.message || 'Verify failed')
      const access = j?.access_token
      if (!access) throw new Error('Нет access_token в ответе')

      // 2) Обновляем пароль
      const r2 = await fetch(`${SUPA}/auth/v1/user`, {
        method: 'PUT',
        headers: {'Content-Type':'application/json','apikey':ANON,'Authorization':`Bearer ${access}`},
        body: JSON.stringify({ password: pass1 }),
      })
      if (!r2.ok) throw new Error('Ошибка обновления пароля')

      setMsg('✅ Пароль обновлён. Сейчас вернёмся на вход...')
      setTimeout(()=>router.replace('/auth'), 1500)
    } catch (e:any) {
      setMsg('Ошибка: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const box: React.CSSProperties = {background:'#0f172a',border:'1px solid #1f2937',borderRadius:12,padding:20,width:'100%',maxWidth:420,margin:'80px auto',color:'#e5e7eb',textAlign:'center'}
  const input: React.CSSProperties = {display:'block',width:'100%',margin:'10px 0',padding:'10px',borderRadius:8,border:'1px solid #1f2937',background:'#0b1220',color:'#e5e7eb'}
  const btn: React.CSSProperties = {width:'100%',padding:'10px',borderRadius:8,border:'none',background:'linear-gradient(90deg,#22d3ee,#3b82f6)',color:'#0b1220',fontWeight:700,cursor:'pointer'}

  return (
    <div style={box}>
      <h2>🔐 Смена пароля</h2>
      {token ? (
        <>
          <input type="password" placeholder="Новый пароль" value={pass1} onChange={e=>setPass1(e.target.value)} style={input}/>
          <input type="password" placeholder="Повторите пароль" value={pass2} onChange={e=>setPass2(e.target.value)} style={input}/>
          <button disabled={loading} onClick={handleReset} style={btn}>{loading ? '⏳ Обновляем…' : 'Обновить пароль'}</button>
          {msg && <p style={{marginTop:12,opacity:.9}}>{msg}</p>}
        </>
      ) : (
        <p>⚠️ Ссылка недействительна или устарела.</p>
      )}
    </div>
  )
}

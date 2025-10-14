import { useState, type CSSProperties } from 'react'

export default function AuthPage() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-sql-advisor-next.vercel.app'
  const [tab, setTab] = useState<'signin'|'signup'|'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const post = async (url:string, body:any) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(body)
    })
    return r
  }

  const signIn = async () => {
    setLoading(true)
    const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`
    const r = await post(url, { email, password })
    const d = await r.json()
    if (r.ok) {
      localStorage.setItem('jwt', d.access_token)
      setMsg('✅ Вход выполнен!')
      setTimeout(()=>location.href='/', 800)
    } else setMsg('Ошибка: '+(d.error_description||d.msg))
    setLoading(false)
  }

  const signUp = async () => {
    setLoading(true)
    const url = `${SUPABASE_URL}/auth/v1/signup`
    const r = await post(url, { email, password })
    const d = await r.json()
    setMsg(r.ok ? '✅ Проверьте почту для подтверждения' : 'Ошибка: '+(d.msg||d.error_description))
    setLoading(false)
  }

  const recover = async () => {
    setLoading(true)
    const url = `${SUPABASE_URL}/auth/v1/recover`
    const r = await post(url, { email, redirect_to: SITE_URL })
    setMsg(r.ok ? '✅ Ссылка на сброс пароля отправлена' : 'Ошибка: '+r.statusText)
    setLoading(false)
  }

  const googleUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${SITE_URL}`

  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{margin:'0 0 10px'}}>🧠 AI SQL Advisor</h2>
        <p style={{opacity:.7,marginBottom:20}}>Авторизация</p>

        <div style={tabs}>
          <button onClick={()=>setTab('signin')} style={tabBtn(tab==='signin')}>Sign in</button>
          <button onClick={()=>setTab('signup')} style={tabBtn(tab==='signup')}>Sign up</button>
          <button onClick={()=>setTab('reset')} style={tabBtn(tab==='reset')}>Reset</button>
        </div>

        {tab!=='reset' && (
          <>
            <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={input}/>
            <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} style={input}/>
          </>
        )}

        {tab==='reset' && (
          <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={input}/>
        )}

        {tab==='signin' && <button onClick={signIn} disabled={loading} style={btn}>{loading?'⏳':'Войти'}</button>}
        {tab==='signup' && <button onClick={signUp} disabled={loading} style={btn}>{loading?'⏳':'Создать аккаунт'}</button>}
        {tab==='reset' && <button onClick={recover} disabled={loading} style={btn}>{loading?'⏳':'Сбросить пароль'}</button>}

        <a href={googleUrl} style={gBtn}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="G"/>
          <span>Continue with Google</span>
        </a>

        {msg && <p style={{marginTop:10,whiteSpace:'pre-wrap'}}>{msg}</p>}
      </div>
    </div>
  )
}

/* typed styles */
const wrap: CSSProperties = { display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#0b1220' }
const card: CSSProperties = {
  background:'#0f172a', padding:30, borderRadius:12, border:'1px solid #1f2937',
  color:'#e5e7eb', width:300, textAlign: 'center' as CSSProperties['textAlign']
}
const tabs: CSSProperties = { display:'flex', gap:8, marginBottom:12, justifyContent:'center' }
const tabBtn = (active:boolean): CSSProperties => ({
  padding:'6px 10px', borderRadius:8, border:'1px solid #1f2937',
  background: active ? '#111827' : '#0b1220', color:'#e5e7eb', cursor:'pointer'
})
const input: CSSProperties = { width:'100%', marginBottom:10, borderRadius:8, border:'1px solid #1f2937', background:'#0b1220', color:'#e5e7eb', padding:'8px 10px' }
const btn: CSSProperties = { width:'100%', marginTop:4, padding:'10px', borderRadius:8, border:'none', background:'linear-gradient(90deg,#22d3ee,#3b82f6)', color:'#0b1220', fontWeight:700, cursor:'pointer' }
const gBtn: CSSProperties = { display:'inline-flex', alignItems:'center', gap:8, marginTop:10, padding:'8px 14px', background:'#fff', color:'#111827', borderRadius:8, textDecoration:'none', fontWeight:600 }

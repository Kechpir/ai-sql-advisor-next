import { useState } from 'react'

export default function AuthPage() {
  const [tab, setTab] = useState<'signin'|'signup'|'reset'>('signin')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  async function req(path:string, body:any) {
    const r = await fetch(`${SUPA}/auth/v1/${path}`, {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':ANON,'Authorization':`Bearer ${ANON}`},
      body:JSON.stringify(body)
    })
    return r
  }

  async function login() {
    setLoading(true); setMsg('')
    try {
      const r = await req('token?grant_type=password',{email,password:pass})
      const j = await r.json()
      if(!r.ok) throw new Error(j.error_description||j.message)
      localStorage.setItem('jwt', j.access_token)
      setMsg('✅ Успешный вход'); setTimeout(()=>location.href='/',1000)
    } catch(e:any){ setMsg('Ошибка входа: '+e.message) }
    finally{ setLoading(false) }
  }

  async function signup() {
    setLoading(true); setMsg('')
    try {
      const r = await req('signup',{email,password:pass})
      const j = await r.json()
      if(!r.ok) throw new Error(j.error_description||j.message)
      setMsg('📨 Проверьте почту для подтверждения.')
    } catch(e:any){ setMsg('Ошибка регистрации: '+e.message) }
    finally{ setLoading(false) }
  }

  async function reset() {
    setLoading(true); setMsg('')
    try {
      const r = await req('recover',{email,redirect_to:window.location.origin})
      if(!r.ok) throw new Error(await r.text())
      setMsg('📨 Ссылка для сброса пароля отправлена.')
    } catch(e:any){ setMsg('Ошибка сброса: '+e.message) }
    finally{ setLoading(false) }
  }

  const box = {background:'#0f172a',border:'1px solid #1f2937',borderRadius:12,padding:20,width:'100%',maxWidth:400,margin:'60px auto'}
  const input = {background:'#0b1220',color:'#e5e7eb',border:'1px solid #1f2937',borderRadius:10,padding:'10px 12px',width:'100%',marginBottom:10}

  return (
    <div style={box}>
      <h2 style={{marginTop:0}}>🧠 AI SQL Advisor</h2>
      <p style={{opacity:.7,marginTop:-8,marginBottom:20}}>Вход и регистрация</p>

      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <button onClick={()=>setTab('signin')} style={tabBtn(tab==='signin')}>Вход</button>
        <button onClick={()=>setTab('signup')} style={tabBtn(tab==='signup')}>Регистрация</button>
        <button onClick={()=>setTab('reset')} style={tabBtn(tab==='reset')}>Сброс</button>
      </div>

      {tab!=='reset' && (
        <>
          <input style={input} placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input style={input} placeholder="Пароль" type="password" value={pass} onChange={e=>setPass(e.target.value)} />
          <button disabled={loading} onClick={tab==='signin'?login:signup} style={btnMain}>
            {loading ? '⏳' : tab==='signin' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </>
      )}

      {tab==='reset' && (
        <>
          <input style={input} placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
          <button disabled={loading} onClick={reset} style={btnMain}>{loading ? '⏳' : 'Отправить ссылку'}</button>
        </>
      )}

      {msg && <div style={{marginTop:12,opacity:.9}}>{msg}</div>}
    </div>
  )
}

const tabBtn=(active:boolean)=>({
  flex:1,borderRadius:8,padding:'8px 10px',
  border:'1px solid #1f2937',
  background:active?'#111827':'#0b1220',
  color:'#e5e7eb',cursor:'pointer'
})
const btnMain={background:'linear-gradient(90deg,#22d3ee,#3b82f6)',color:'#0b1220',fontWeight:700,border:'none',borderRadius:10,padding:'10px 14px',width:'100%',marginTop:4,cursor:'pointer'}

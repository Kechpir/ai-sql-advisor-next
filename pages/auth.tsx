import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function AuthPage() {
  const router = useRouter()

  const SUPA  = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const ANON  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const SITE  = process.env.NEXT_PUBLIC_SITE_URL || (typeof window!=='undefined'?window.location.origin:'')

  // tabs: вход/рег/сброс
  const [tab, setTab] = useState<'signin'|'signup'|'reset'>('signin')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [msg,  setMsg]  = useState('')
  const [loading, setLoading] = useState(false)

  // recovery / oauth callback
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null)
  const [newPass, setNewPass] = useState('')
  const [newPass2, setNewPass2] = useState('')

  // === Утилита REST
  async function req(path:string, body:any) {
    const r = await fetch(`${SUPA}/auth/v1/${path}`, {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':ANON,'Authorization':`Bearer ${ANON}`},
      body:JSON.stringify(body)
    })
    return r
  }

  // === Маппер ошибок Supabase Auth -> дружелюбные тексты
  function parseAuthError(status: number, j: any) {
    const raw = (j?.error_description || j?.message || j?.msg || "")
    const msg = String(raw)

    // ЛОГИН
    if (status === 400 && /(invalid_grant|Invalid login credentials)/i.test(msg)) {
      return "❌ Неверный email или пароль."
    }
    if (/user_not_found|No user found/i.test(msg)) {
      return "❌ Неверный email или пароль."
    }

    // РЕГИСТРАЦИЯ
    if (status === 409 || /already exists|user already registered/i.test(msg)) {
      return "⚠️ Такой email уже зарегистрирован. Нажмите ‘Вход’ или ‘Сброс пароля’."
    }
    if (status === 422 && /password|weak|short/i.test(msg)) {
      return "🔒 Пароль слишком короткий. Минимум 6 символов (лучше сложнее)."
    }

    // Другое
    if (status === 429 || /too many|rate/i.test(msg)) return "⏳ Слишком много попыток. Попробуйте позже."
    if (status === 400 && /(Email not confirmed|email not confirmed)/i.test(msg)) return "✉️ Подтвердите email — проверьте почту."
    return (raw || `Ошибка (${status})`)
  }

  // === Коллбеки OAuth/Recovery
  useEffect(()=>{
    if (typeof window==='undefined') return
    const hash  = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const qs    = new URLSearchParams(window.location.search)

    const accessFromHash  = hash.get('access_token')
    const accessFromQuery = qs.get('access_token')
    const tokenHash       = qs.get('token_hash') || hash.get('token_hash')
    const type            = (hash.get('type') || qs.get('type') || '').toLowerCase()

    // OAuth возврат
    const oauthAccess = accessFromHash || accessFromQuery
    if (oauthAccess && type !== 'recovery') {
      try { localStorage.setItem('jwt', oauthAccess); router.replace('/') } catch(e){ console.error(e) }
      return
    }

    // Recovery с access_token
    if ((accessFromHash || accessFromQuery) && type === 'recovery') {
      try { localStorage.removeItem('jwt') } catch {}
      setRecoveryToken(accessFromHash || accessFromQuery)
      setTab('reset')
      setMsg('Введите новый пароль и подтвердите.')
      return
    }

    // Recovery через token_hash -> verify
    async function exchangeTokenHash(th: string) {
      try {
        setLoading(true)
        const r = await fetch(`${SUPA}/auth/v1/verify`, {
          method: 'POST',
          headers: {'Content-Type':'application/json','apikey': ANON,'Authorization': `Bearer ${ANON}`},
          body: JSON.stringify({ type: 'recovery', token_hash: th }),
        })
        const j = await r.json().catch(()=> ({}))
        if (!r.ok) throw new Error(j.error_description || j.message || 'Verify failed')
        if (j?.access_token) {
          try { localStorage.removeItem('jwt') } catch {}
          setRecoveryToken(j.access_token)
          setTab('reset')
          setMsg('Введите новый пароль и подтвердите.')
          return
        }
        throw new Error('No access_token in verify response')
      } catch (e:any) {
        console.error('verify error', e)
        setMsg('Не удалось подтвердить ссылку восстановления: ' + e.message)
      } finally {
        setLoading(false)
      }
    }

    if (type === 'recovery' && tokenHash) {
      exchangeTokenHash(tokenHash)
      return
    }
  },[router, SUPA, ANON])

  // Уже залогинен? — на главную (не мешаем recovery)
  useEffect(()=>{
    try{
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const q = new URLSearchParams(window.location.search)
      const t = (h.get('type') || q.get('type') || '').toLowerCase()
      if (t === 'recovery') return
      if (localStorage.getItem('jwt')) router.replace('/')
    }catch{}
  },[router])

  // === ДЕЙСТВИЯ
  async function login() {
    setLoading(true); setMsg('')
    try {
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Введите корректный email.")
      if (!pass) throw new Error("Введите пароль.")
      const r = await req('token?grant_type=password', { email, password: pass })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(parseAuthError(r.status, j))
      localStorage.setItem('jwt', j.access_token)
      router.replace('/')
    } catch(e:any){ setMsg(e.message || 'Ошибка входа.') }
    finally{ setLoading(false) }
  }

  async function signup() {
    setLoading(true); setMsg('')
    try {
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Введите корректный email.")
      if (!pass || pass.length < 6) throw new Error("�� Пароль слишком короткий. Минимум 6 символов.")
      const r = await req('signup', {
        email,
        password: pass,
        email_redirect_to: (SITE?.endsWith('/auth') ? SITE : (SITE + '/auth')),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(parseAuthError(r.status, j))
      setMsg(`📨 Письмо для подтверждения отправлено на ${email}. Перейдите по ссылке и затем войдите.`)
    } catch(e:any){ setMsg(e.message || 'Ошибка регистрации.') }
    finally{ setLoading(false) }
  }

  // без утечки существования
  async function sendResetLink() {
    setLoading(true); setMsg('')
    try {
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Введите корректный email.")
      const r = await req('recover',{email,redirect_to: `${SITE}/auth`})
      if (!r.ok) { await r.text().catch(()=> ''); /* не палим детали */ }
      setMsg('📨 Если аккаунт существует, письмо для сброса отправлено. Проверьте почту.')
    } catch(e:any){ setMsg(e.message || 'Ошибка сброса.') }
    finally{ setLoading(false) }
  }

  async function applyNewPassword() {
    if (!recoveryToken) return setMsg('Нет токена восстановления.')
    if (!newPass || newPass !== newPass2) return setMsg('Пароли не совпадают.')
    setLoading(true); setMsg('')
    try {
      const r = await fetch(`${SUPA}/auth/v1/user`, {
        method:'PUT',
        headers:{'Content-Type':'application/json','apikey': ANON,'Authorization': `Bearer ${recoveryToken}`},
        body: JSON.stringify({ password: newPass })
      })
      const j = await r.json().catch(()=> ({}))
      if(!r.ok) throw new Error(j.error_description||j.message||'Ошибка смены пароля')
      localStorage.setItem('jwt', recoveryToken)
      setMsg('✅ Пароль обновлён')
      router.replace('/')
    } catch(e:any){ setMsg(e.message) }
    finally{ setLoading(false) }
  }

  const GOOGLE_URL = "/api/google-login"

  // стили
  const box = {background:'#0f172a',border:'1px solid #1f2937',borderRadius:12,padding:20,width:'100%',maxWidth:420,margin:'60px auto'} as const
  const input = {background:'#0b1220',color:'#e5e7eb',border:'1px solid #1f2937',borderRadius:10,padding:'10px 12px',width:'100%',marginBottom:10} as const
  const row  = {display:'flex',gap:8,marginBottom:12} as const
  const btn  = {background:'linear-gradient(90deg,#22d3ee,#3b82f6)',color:'#0b1220',fontWeight:700,border:'none',borderRadius:10,padding:'10px 14px',width:'100%',marginTop:4,cursor:'pointer'} as const
  const tabBtn=(active:boolean)=>({flex:1,borderRadius:8,padding:'8px 10px',border:'1px solid #1f2937',background:active?'#111827':'#0b1220',color:'#e5e7eb',cursor:'pointer'}) as const
  const googleBtn={display:'flex',alignItems:'center',gap:10,justifyContent:'center',marginTop:12,background:'#fff',color:'#111827',borderRadius:10,padding:'10px 14px',textDecoration:'none',fontWeight:700,boxShadow:'0 2px 6px rgba(0,0,0,.25)'} as const

  return (
    <div style={box}>
      <h2 style={{marginTop:0}}>🧠 AI SQL Advisor</h2>
      <p style={{opacity:.7,marginTop:-8,marginBottom:20}}>Вход / Регистрация / Сброс</p>

      {/* Экран смены пароля (recovery) */}
      {recoveryToken ? (
        <>
          <input style={input} placeholder="Новый пароль" type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} />
          <input style={input} placeholder="Повторите пароль" type="password" value={newPass2} onChange={e=>setNewPass2(e.target.value)} />
          <button disabled={loading} onClick={applyNewPassword} style={btn}>{loading ? '⏳' : 'Обновить пароль'}</button>
          {msg && <div style={{marginTop:12,opacity:.9}}>{msg}</div>}
        </>
      ) : (
        <>
          <div style={row}>
            <button onClick={()=>setTab('signin')} style={tabBtn(tab==='signin')}>Вход</button>
            <button onClick={()=>setTab('signup')} style={tabBtn(tab==='signup')}>Регистрация</button>
            <button onClick={()=>setTab('reset')}  style={tabBtn(tab==='reset')}>Сброс</button>
          </div>

          {/* Обычный вход/регистрация */}
          {tab!=='reset' && (
            <>
              <input style={input} placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
              <input style={input} placeholder="Пароль" type="password" value={pass} onChange={e=>setPass(e.target.value)} />
              <button disabled={loading} onClick={tab==='signin'?login:signup} style={btn}>
                {loading ? '⏳' : tab==='signin' ? 'Войти' : 'Создать аккаунт'}
              </button>
              {/* глобальные сообщения для входа/регистрации */}
              {msg && <div style={{marginTop:12,opacity:.9}}>{msg}</div>}

              <a href={GOOGLE_URL} style={googleBtn} target="_self" rel="noopener">
                <svg style={{width:18,height:18}} viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.9 0-12.5-5.6-12.5-12.5S17.1 11 24 11c3.2 0 6.1 1.2 8.3 3.2l5.7-5.7C34.6 5.2 29.6 3 24 3 16 3 9 7.4 6.3 14.7z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.9 16.5 19 14 24 14c3.2 0 6.1 1.2 8.3 3.2l5.7-5.7C34.6 5.2 29.6 3 24 3 16 3 9 7.4 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 45c5.4 0 10.3-1.8 14.1-4.9l-6.5-5.4C29.6 36.5 26.9 37.5 24 37.5c-5.2 0-9.6-3.3-11.2-8.1l-6.6 5.1C8.9 41.1 15.9 45 24 45z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.2 3.4-3.8 6.1-7 7.6l6.5 5.4C38.3 39.2 42 32.6 42 24c0-1.3-.1-2.6-.4-3.5z"/>
                </svg>
                <span>Continue with Google</span>
              </a>
            </>
          )}

          {/* Сброс пароля */}
          {tab==='reset' && (
            <>
              <input style={input} placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
              <button disabled={loading} onClick={sendResetLink} style={btn}>{loading ? '⏳' : 'Отправить ссылку'}</button>
              {msg && <div style={{marginTop:12,opacity:.9}}>{msg}</div>}
            </>
          )}
        </>
      )}
    </div>
  )
}

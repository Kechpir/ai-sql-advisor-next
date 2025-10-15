import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function AuthPage() {
  // Навешиваем редирект на кнопку "Continue with Google" или "Войти через Google"
  React.useEffect(() => {
    const els = Array.from(document.querySelectorAll("button, a, div, span"));
    const btn = els.find((el) => {
      const t = (el.textContent || "").trim();
      return /^(Continue with Google|Войти через Google)$/i.test(t);
    });
    if (btn) {
      btn.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (typeof window !== "undefined") {
            (window.top ?? window).location.href = "/api/google-login";
          }
        },
        { capture: true }
      );
    }
  }, []);

  const router = useRouter();
  React.useEffect(() => {
    try {
      if (localStorage.getItem("jwt")) router.replace("/");
    } catch {}
  }, [router]);


  async function login() {
    setLoading(true); setMsg('')
    try {
      const r = await req('token?grant_type=password',{email,password:pass})
      const j = await r.json()
      if(!r.ok) throw new Error(j.error_description||j.message)
      localStorage.setItem('jwt', j.access_token)
      setMsg('✅ Успешный вход'); setTimeout(()=>location.href='/',700)
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
      const r = await req('recover',{email,redirect_to:SITE})
      if(!r.ok) throw new Error(await r.text())
      setMsg('📨 Ссылка для сброса пароля отправлена.')
    } catch(e:any){ setMsg('Ошибка сброса: '+e.message) }
    finally{ setLoading(false) }
  }

  const box = {background:'#0f172a',border:'1px solid #1f2937',borderRadius:12,padding:20,width:'100%',maxWidth:400,margin:'60px auto'} as const
  const input = {background:'#0b1220',color:'#e5e7eb',border:'1px solid #1f2937',borderRadius:10,padding:'10px 12px',width:'100%',marginBottom:10} as const
  const row  = {display:'flex',gap:8,marginBottom:12} as const

  return (
    <div style={box}>
      <h2 style={{marginTop:0}}>🧠 AI SQL Advisor</h2>
      <p style={{opacity:.7,marginTop:-8,marginBottom:20}}>Вход и регистрация</p>

      <div style={row}>
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

      {/* Google OAuth — фирменная кнопка */}
      <a href={GOOGLE_URL} style={googleBtn} target="_self" rel="noopener">
        <svg style={{width:18,height:18}} viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.9 0-12.5-5.6-12.5-12.5S17.1 11 24 11c3.2 0 6.1 1.2 8.3 3.2l5.7-5.7C34.6 5.2 29.6 3 24 3 12.3 3 3 12.3 3 24s9.3 21 21 21c10.5 0 20-7.6 20-21 0-1.3-.1-2.6-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.9 16.5 19 14 24 14c3.2 0 6.1 1.2 8.3 3.2l5.7-5.7C34.6 5.2 29.6 3 24 3 16 3 9 7.4 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 45c5.4 0 10.3-1.8 14.1-4.9l-6.5-5.4C29.6 36.5 26.9 37.5 24 37.5c-5.2 0-9.6-3.3-11.2-8.1l-6.6 5.1C8.9 41.1 15.9 45 24 45z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.2 3.4-3.8 6.1-7 7.6l6.5 5.4C38.3 39.2 42 32.6 42 24c0-1.3-.1-2.6-.4-3.5z"/>
        </svg>
        <span>Continue with Google</span>
      </a>

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
const googleBtn={display:'flex',alignItems:'center',gap:10,justifyContent:'center',marginTop:12,
  background:'#fff',color:'#111827',borderRadius:10,padding:'10px 14px',textDecoration:'none',fontWeight:700,boxShadow:'0 2px 6px rgba(0,0,0,.25)'} as const

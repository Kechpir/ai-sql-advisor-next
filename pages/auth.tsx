import React from "react";

export default function AuthPage() {
  const SITE =
    process.env.NEXT_PUBLIC_SUPABASE_SITE ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://ai-sql-advisor-next.vercel.app";

  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://zpppzzwaoplfeoiynkam.supabase.co";

  // теперь просто ссылаемся на наш API-редирект
  const googleHref = "/api/google-login";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0b0d12",
        color: "#e6e7ea",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#11141a",
          border: "1px solid #1c2330",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 8px 24px rgba(0,0,0,.35)",
        }}
      >
        <h1
          style={{
            margin: "0 0 12px",
            fontSize: 24,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          Вход / Регистрация
        </h1>

        <p
          style={{
            margin: "0 0 20px",
            opacity: 0.8,
            fontSize: 14,
            textAlign: "center",
          }}
        >
          Войдите через Google — быстро и безопасно.
        </p>

        <a
          href={googleHref}
          target="_top"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: 44,
            borderRadius: 12,
            textDecoration: "none",
            border: "1px solid #2a3446",
            background: "#0f62fe",
            color: "#fff",
            fontWeight: 600,
            letterSpacing: 0.2,
          }}
        >
          Continue with Google
        </a>

        <div
          style={{
            marginTop: 14,
            fontSize: 12,
            opacity: 0.7,
            lineHeight: 1.4,
            textAlign: "center",
          }}
        >
          Если кнопка не открывает окно входа — обновите страницу (Ctrl+F5)
          или попробуйте в режиме инкогнито.
        </div>

        <noscript>
          <div style={{ marginTop: 12, color: "#fca5a5" }}>
            Для входа нужен JavaScript. Или перейдите вручную:{" "}
            {SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=
            {encodeURIComponent(SITE + "/auth")}
          </div>
        </noscript>
      </div>
    </main>
  );
}

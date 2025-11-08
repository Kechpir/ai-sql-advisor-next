import { useEffect } from "react";

export default function OAuthHashHandler() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash || "";
    if (!hash.startsWith("#")) return;

    const params = new URLSearchParams(hash.slice(1));
    const access = params.get("access_token");
    const error = params.get("error_description") || params.get("error");

    // очищаем hash из адресной строки
    const clearHash = () => {
      try {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch {}
    };

    if (access) {
      try { localStorage.setItem("jwt", access); } catch {}
      clearHash();
      // уводим на главную
      window.location.href = "/";
      return;
    }

    if (error) {
      // можно сохранить в sessionStorage и прочитать на /auth, если захочешь показать тост
      try { sessionStorage.setItem("oauth_error", String(error)); } catch {}
      clearHash();
      // остаёмся на /auth
    }
  }, []);

  return null;
}

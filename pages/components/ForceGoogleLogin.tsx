import { useEffect } from "react";

export default function ForceGoogleLogin() {
  useEffect(() => {
    const go = () => {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      // важное: прокидываем целевой редирект обратно на ТЕКУЩИЙ хост
      const url =
        `/api/google-login?redirectTo=${encodeURIComponent(`${origin}/auth`)}`;

      (typeof window !== "undefined" ? (window.top ?? window) : { location: { href: "" } } as any)
        .location.href = url;
    };

    // Ищем кнопку по тексту (RU/EN) и вешаем обработчик
    const tryBind = () => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>("button, a, div, span")
      );
      const btn = candidates.find((el) => {
        const t = (el.innerText || el.textContent || "").trim();
        return /^(Continue with Google|Войти через Google)$/i.test(t);
      });
      if (btn && btn.getAttribute("data-google-wired") !== "1") {
        btn.style.cursor = "pointer";
        btn.addEventListener(
          "click",
          (e) => {
            e.preventDefault();
            e.stopPropagation();
            go();
          },
          { once: false }
        );
        btn.setAttribute("data-google-wired", "1");
        return true;
      }
      return false;
    };

    // Пытаемся сразу и следим за изменениями DOM
    let bound = tryBind();
    const mo = new MutationObserver(() => {
      if (!bound) bound = tryBind();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    return () => mo.disconnect();
  }, []);

  return null;
}

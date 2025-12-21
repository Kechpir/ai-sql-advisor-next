import { useEffect } from "react";

export default function ForceGoogleLogin() {
  useEffect(() => {
    const go = () => {
      const url = '/api/google-login';
      (typeof window !== 'undefined' ? (window.top ?? window) : { location: { href: '' } }).location.href = url;
    };

    // Ищем кнопку по тексту (RU/EN) и вешаем обработчик
    const tryBind = () => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, a, div, span'));
      const btn = candidates.find(el => {
        const t = (el.innerText || el.textContent || '').trim();
        return /^(Continue with Google|Войти через Google)$/i.test(t);
      });
      if (btn) {
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); go(); }, { once: false });
        // помечаем, чтобы не дублить
        btn.setAttribute('data-google-wired', '1');
        return true;
      }
      return false;
    };

    // Пытаемся сразу и следим за изменениями DOM
    let bound = tryBind();
    const mo = new MutationObserver(() => { if (!bound) bound = tryBind(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    return () => mo.disconnect();
  }, []);

  return null;
}

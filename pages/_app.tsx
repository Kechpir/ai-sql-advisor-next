import type { AppProps } from "next/app";

// ✅ Подключаем глобальные стили в правильном порядке
import "../styles/globals.css";
import "../styles/sql-interface.css";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

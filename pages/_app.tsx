import type { AppProps } from "next/app";

// ✅ Подключаем глобальные стили (всё, что относится к UI)
import "@/styles/globals.css";
import "@/styles/sql-interface.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#0b1220" }}>
      <Component {...pageProps} />
    </main>
  );
}

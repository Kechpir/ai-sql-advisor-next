import type { AppProps } from "next/app";
import "../styles/globals.css";
//import "../styles/main.css"; // ✅ подключаем новый кастомный стиль
import "../styles/sql-interface.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#0b1220" }}>
      <Component {...pageProps} />
    </main>
  );
}

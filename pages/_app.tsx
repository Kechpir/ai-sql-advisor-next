import type { AppProps } from "next/app";

// 🔹 Сначала общие стили
import "@/styles/globals.css";

// 🔹 Затем основной интерфейс
import "@/styles/sql-interface.css";

// 🔹 И только потом твой кастомный UI (он должен быть последним!)
import "@/styles/ui.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#0b1220" }}>
      <Component {...pageProps} />
    </main>
  );
}

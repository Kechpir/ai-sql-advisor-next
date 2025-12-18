import type { AppProps } from "next/app";
import Head from "next/head";

// 🎨 Единый глобальный стиль
import "./styles/main.css";




export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>AI SQL Advisor</title>
        <meta
          name="description"
          content="Визуальный AI SQL Builder — генерация запросов, анализ и оптимизация SQL"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="app-layout">
        <Component {...pageProps} />
      </main>

      <style jsx global>{`
        .app-layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: radial-gradient(circle at top, #0b1220 0%, #060a12 100%);
          color: #e5e7eb;
          font-family: "Inter", sans-serif;
          transition: background 0.3s ease;
          padding: 1rem;
        }
      `}</style>
    </>
  );
}

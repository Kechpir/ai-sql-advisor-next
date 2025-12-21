import React from "react";
import SidebarMenu from "./SidebarMenu";
import SqlBuilderPanel from "./SqlBuilderPanel";
// import TransactionPanel from "./TransactionPanel";
import "../styles/globals.css";

/**
 * Главный каркас приложения
 * Слева — панель навигации, справа — SQL редактор и блок транзакций
 */
export default function AppLayout() {
  return (
    <div className="layout">
      {/* ==== SIDEBAR ==== */}
      <aside className="sidebar">
        <SidebarMenu />
      </aside>

      {/* ==== MAIN CONTENT ==== */}
      <main className="main-content">
        <section className="panel">
          <SqlBuilderPanel />
        </section>

        {/* <section className="panel" style={{ marginTop: "1.5rem" }}>
          <TransactionPanel />
        </section> */}
      </main>
    </div>
  );
}

"use client";
import React from "react";
import SqlBuilderApp from "./SqlBuilderApp";

/**
 * 🎛️ SqlBuilderPanel
 * — обёртка, подключающая изолированный конструктор SQL
 * — больше ничего не ломает, не влезает в стили других страниц
 */

export default function SqlBuilderPanel() {
  return (
    <div className="sql-builder-root">
      <SqlBuilderApp />
    </div>
  );
}

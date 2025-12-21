import React from "react";

interface LimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: "limit" | "error";
}

export default function LimitModal({ isOpen, onClose, title, message, type = "limit" }: LimitModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "linear-gradient(135deg, rgba(11, 18, 32, 0.95) 0%, rgba(6, 9, 20, 0.98) 100%)",
          border: `1px solid ${type === "limit" ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
          borderRadius: "16px",
          padding: "24px 32px",
          maxWidth: "500px",
          width: "90%",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 216, 255, 0.1)",
          color: "#e5e7eb",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Иконка */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: type === "limit" 
              ? "linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)"
              : "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%)",
            margin: "0 auto 20px",
            border: `2px solid ${type === "limit" ? "rgba(245, 158, 11, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
          }}
        >
          <span style={{ fontSize: "32px" }}>
            {type === "limit" ? "⚠️" : "❌"}
          </span>
        </div>

        {/* Заголовок */}
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: "20px",
            fontWeight: "600",
            color: type === "limit" ? "#f59e0b" : "#ef4444",
            textAlign: "center",
          }}
        >
          {title}
        </h3>

        {/* Сообщение */}
        <div
          style={{
            margin: "0 0 24px 0",
            fontSize: "15px",
            lineHeight: "1.6",
            color: "#d1d5db",
            textAlign: "center",
            whiteSpace: "pre-line",
          }}
        >
          {message}
        </div>

        {/* Кнопка */}
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "12px 24px",
            background: type === "limit"
              ? "linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)"
              : "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%)",
            border: `1px solid ${type === "limit" ? "rgba(245, 158, 11, 0.5)" : "rgba(239, 68, 68, 0.5)"}`,
            borderRadius: "10px",
            color: "#e5e7eb",
            fontSize: "15px",
            fontWeight: "500",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = type === "limit"
              ? "linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(245, 158, 11, 0.2) 100%)"
              : "linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.2) 100%)";
            e.currentTarget.style.transform = "scale(1.02)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = type === "limit"
              ? "linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)"
              : "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%)";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          Понятно
        </button>
      </div>
    </div>
  );
}


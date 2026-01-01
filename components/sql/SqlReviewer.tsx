import { useState } from "react";
import { reviewSql } from "@/lib/api";

interface SqlReviewerProps {
  sql: string;
  schema?: any;
  dialect?: string;
  naturalLanguageQuery?: string;
  onClose?: () => void;
}

export default function SqlReviewer({ sql, schema, dialect = "postgres", naturalLanguageQuery, onClose }: SqlReviewerProps) {
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReview = async () => {
    setLoading(true);
    setError(null);
    setReview(null);

    try {
      const result = await reviewSql({
        sql,
        schema,
        dialect,
        natural_language_query: naturalLanguageQuery,
      });
      setReview(result.review);
    } catch (e: any) {
      setError(e.message || "Ошибка получения ревью");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.95)",
        border: "1px solid rgba(34, 211, 238, 0.3)",
        borderRadius: "8px",
        padding: "12px 16px",
        marginTop: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ color: "#22d3ee", fontSize: "14px", fontWeight: 600 }}>
          💡 AI Подсказка
        </span>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#9ca3af",
              padding: "4px 8px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            ✖
          </button>
        )}
      </div>

      {!review && !loading && !error && (
        <button
          onClick={handleReview}
          style={{
            width: "100%",
            padding: "8px 16px",
            background: "rgba(34, 211, 238, 0.1)",
            border: "1px solid rgba(34, 211, 238, 0.3)",
            borderRadius: "6px",
            color: "#22d3ee",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          💡 Получить подсказку
        </button>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "12px", color: "#9ca3af", fontSize: "13px" }}>
          ⏳ Анализирую...
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "6px",
            color: "#fca5a5",
            fontSize: "12px",
          }}
        >
          {error}
        </div>
      )}

      {review && (
        <div>
          <div
            style={{
              background: "#0b1220",
              border: "1px solid rgba(51, 65, 85, 0.5)",
              borderRadius: "6px",
              padding: "12px",
              color: "#e5e7eb",
              fontSize: "13px",
              lineHeight: "1.5",
            }}
          >
            {review}
          </div>
        </div>
      )}
    </div>
  );
}


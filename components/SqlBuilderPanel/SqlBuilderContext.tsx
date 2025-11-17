import React, { createContext, useState } from "react";

interface SchemaType {
  [table: string]: string[];
}

interface SqlBuilderContextType {
  schema: SchemaType;
  setSchema: (schema: SchemaType) => void;
}

/**
 * ✅ Глобальный контекст SQL Builder
 * — хранит список таблиц и полей
 * — используется всеми компонентами для dropdown'ов
 */

export const SqlBuilderContext = createContext<SqlBuilderContextType>({
  schema: {},
  setSchema: () => {},
});

export const SqlBuilderProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [schema, setSchema] = useState<SchemaType>({
    users: ["id", "name", "email", "age"],
    orders: ["order_id", "user_id", "total", "created_at"],
  });

  return (
    <SqlBuilderContext.Provider value={{ schema, setSchema }}>
      {children}
    </SqlBuilderContext.Provider>
  );
};

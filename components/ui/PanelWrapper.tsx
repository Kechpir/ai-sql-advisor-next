import React from "react";

interface PanelWrapperProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Единая визуальная обертка для всех SQL панелей
 * Использует базовые стили из /styles/ui.css
 */
export const PanelWrapper: React.FC<PanelWrapperProps> = ({
  title,
  children,
  className = "",
}) => {
  return (
    <div className={`sql-panel ${className}`}>
      {title && <h3 className="text-accent text-lg font-semibold mb-3">{title}</h3>}
      <div className="space-y-3">{children}</div>
    </div>
  );
};

export default PanelWrapper;

import React from "react";

interface Tab {
  id: string;
  title: string;
  sql: string;
  columns: string[];
  rowCount: number;
}

interface TableTabsBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabRename: (id: string, newTitle: string) => void;
}

export default function TableTabsBar({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onTabRename,
}: TableTabsBarProps) {
  const [editingTabId, setEditingTabId] = React.useState<string | null>(null);
  const [editingTitle, setEditingTitle] = React.useState("");

  const handleRenameStart = (tab: Tab) => {
    setEditingTabId(tab.id);
    setEditingTitle(tab.title);
  };

  const handleRenameSubmit = (id: string) => {
    if (editingTitle.trim()) {
      onTabRename(id, editingTitle.trim());
    } else {
      // Если имя пустое, оставляем исходное
      const tab = tabs.find(t => t.id === id);
      if (tab) {
        setEditingTitle(tab.title);
      }
    }
    setEditingTabId(null);
    setEditingTitle("");
  };

  const handleRenameCancel = () => {
    setEditingTabId(null);
    setEditingTitle("");
  };

  if (tabs.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "40px",
        backgroundColor: "#f3f3f3",
        borderTop: "1px solid #d0d0d0",
        display: "flex",
        alignItems: "center",
        zIndex: 999,
        overflowX: "auto",
        overflowY: "hidden",
      }}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onTabClick(tab.id)}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "6px 12px",
            backgroundColor: activeTabId === tab.id ? "#ffffff" : "#e5e5e5",
            borderRight: "1px solid #d0d0d0",
            borderTop: activeTabId === tab.id ? "2px solid #0078d4" : "2px solid transparent",
            cursor: "pointer",
            minWidth: "120px",
            maxWidth: "200px",
            position: "relative",
            userSelect: "none",
          }}
          onMouseEnter={(e) => {
            if (activeTabId !== tab.id) {
              e.currentTarget.style.backgroundColor = "#f0f0f0";
            }
          }}
          onMouseLeave={(e) => {
            if (activeTabId !== tab.id) {
              e.currentTarget.style.backgroundColor = "#e5e5e5";
            }
          }}
        >
          {editingTabId === tab.id ? (
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={() => handleRenameSubmit(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRenameSubmit(tab.id);
                } else if (e.key === "Escape") {
                  handleRenameCancel();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{
                flex: 1,
                border: "1px solid #0078d4",
                padding: "2px 4px",
                fontSize: "12px",
                outline: "none",
              }}
            />
          ) : (
            <>
              <span
                style={{
                  flex: 1,
                  fontSize: "12px",
                  color: "#1a1a1a", // Темный цвет для лучшей видимости
                  fontWeight: activeTabId === tab.id ? 700 : 500, // Жирный шрифт
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginRight: "4px",
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleRenameStart(tab);
                }}
                title={`Двойной клик для переименования. SQL: ${tab.sql.substring(0, 50)}...`}
              >
                {String(tab.title || `Query ${tabs.indexOf(tab) + 1}`)}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  color: "#666",
                  marginRight: "4px",
                }}
              >
                ({tab.rowCount})
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 4px",
                  fontSize: "14px",
                  color: "#666",
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#d13438";
                  e.currentTarget.style.backgroundColor = "#f0f0f0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#666";
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                ×
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

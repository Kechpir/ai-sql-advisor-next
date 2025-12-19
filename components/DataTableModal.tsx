import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

interface DataTableModalProps {
  id: string;
  sql: string;
  columns: string[];
  rows: any[];
  onClose: (id: string) => void;
  onMinimize?: (id: string, tabName: string) => void;
  isMinimized?: boolean;
  currentName?: string;
}

export default function DataTableModal({ id, sql, columns, rows, onClose, onMinimize, isMinimized, currentName }: DataTableModalProps) {
  const [size, setSize] = useState({ width: 95, height: 90 }); // проценты
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showMinimizeInput, setShowMinimizeInput] = useState(false);
  const [minimizeTabName, setMinimizeTabName] = useState(currentName || "");

  // Обновляем имя если оно изменилось извне
  useEffect(() => {
    if (currentName) setMinimizeTabName(currentName);
  }, [currentName]);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const minimizeInputRef = useRef<HTMLInputElement | null>(null);
  const isSubmittingRef = useRef(false); // Флаг для предотвращения двойного вызова

  // Обработчик подтверждения сворачивания
  const handleMinimizeSubmit = () => {
    if (isSubmittingRef.current) {
      console.log("handleMinimizeSubmit уже выполняется, пропускаем");
      return;
    }
    
    isSubmittingRef.current = true;
    
    // ВАЖНО: Сохраняем значение ДО любых setState, чтобы избежать проблем с замыканием
    const currentNameValue = minimizeTabName.trim();
    const nameToUse = currentNameValue || `Query ${Date.now()}`;
    
    console.log("handleMinimizeSubmit вызван:", { 
      currentName: currentNameValue, 
      nameToUse, 
      minimizeTabName: minimizeTabName,
      minimizeTabNameType: typeof minimizeTabName,
      hasOnMinimize: !!onMinimize 
    });
    
    // Закрываем поле ввода ПОСЛЕ сохранения значения
    setShowMinimizeInput(false);
    const savedName = nameToUse; // Сохраняем в локальную переменную для гарантии
    
    // Вызываем onMinimize с сохраненным именем
    if (onMinimize) {
      console.log("Вызываем onMinimize с именем:", savedName, "тип:", typeof savedName);
      // Используем setTimeout для гарантии, что состояние обновилось
      setTimeout(() => {
        onMinimize(id, savedName);
      }, 0);
    } else {
      console.error("onMinimize не определен!");
    }
    
    // Очищаем поле ввода после небольшой задержки
    setTimeout(() => {
      setMinimizeTabName("");
      isSubmittingRef.current = false;
    }, 100);
  };

  // Ресайз по колесику мыши (Ctrl + Scroll)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setSize((prev) => {
          const delta = e.deltaY > 0 ? -5 : 5;
          return {
            width: Math.max(40, Math.min(100, prev.width + delta)),
            height: Math.max(40, Math.min(100, prev.height + delta)),
          };
        });
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  // Вспомогательная функция для скачивания файла
  const downloadFile = (content: string | Blob, filename: string, mimeType?: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Экспорт в SQL (INSERT statements)
  const exportToSQL = () => {
    if (rows.length === 0) return;
    
    const tableName = "result_table"; // Можно использовать имя из SQL запроса
    const sqlStatements = rows.map(row => {
      const values = columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return "NULL";
        // Экранируем кавычки и экранируем строки
        const escaped = String(value).replace(/'/g, "''");
        return `'${escaped}'`;
      }).join(", ");
      return `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${values});`;
    });
    
    const sqlContent = `-- SQL Export\n-- Generated from query: ${sql}\n\n${sqlStatements.join("\n")}`;
    downloadFile(sqlContent, `table_export_${Date.now()}.sql`, "text/sql");
  };

  // Экспорт в CSV
  const exportToCSV = () => {
    if (rows.length === 0) return;
    
    const headers = columns.map(col => `"${col.replace(/"/g, '""')}"`).join(",");
    const dataRows = rows.map(row => 
      columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return "";
        // Экранируем кавычки и переносы строк
        const escaped = String(value).replace(/"/g, '""').replace(/\n/g, " ");
        return `"${escaped}"`;
      }).join(",")
    );
    const csv = [headers, ...dataRows].join("\n");
    
    downloadFile(csv, `table_export_${Date.now()}.csv`, "text/csv");
  };

  // Экспорт в XLSX
  const exportToXLSX = () => {
    if (rows.length === 0) return;
    
    // Преобразуем данные в формат, который xlsx понимает правильно
    // Используем json_to_sheet для правильного распределения по колонкам
    const data = rows.map(row => {
      const obj: any = {};
      columns.forEach(col => {
        const value = row[col];
        // Обрабатываем разные типы данных
        if (value === null || value === undefined) {
          obj[col] = "";
        } else if (value instanceof Date) {
          obj[col] = value;
        } else if (typeof value === "object") {
          obj[col] = JSON.stringify(value);
        } else {
          obj[col] = value;
        }
      });
      return obj;
    });
    
    // Создаем worksheet из JSON данных
    const worksheet = XLSX.utils.json_to_sheet(data, { header: columns });
    
    // Настраиваем ширину колонок
    const colWidths = columns.map(col => {
      const headerLen = col.length;
      const maxDataLen = Math.max(...rows.map(row => {
        const val = row[col];
        return val !== null && val !== undefined ? String(val).length : 0;
      }));
      return { wch: Math.max(headerLen, maxDataLen, 10) };
    });
    worksheet["!cols"] = colWidths;
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    
    XLSX.writeFile(workbook, `table_export_${Date.now()}.xlsx`);
  };

  // Экспорт в XLS (старый формат Excel)
  const exportToXLS = () => {
    if (rows.length === 0) return;
    
    // Преобразуем данные в формат, который xlsx понимает правильно
    const data = rows.map(row => {
      const obj: any = {};
      columns.forEach(col => {
        const value = row[col];
        if (value === null || value === undefined) {
          obj[col] = "";
        } else if (value instanceof Date) {
          obj[col] = value;
        } else if (typeof value === "object") {
          obj[col] = JSON.stringify(value);
        } else {
          obj[col] = value;
        }
      });
      return obj;
    });
    
    // Создаем worksheet из JSON данных
    const worksheet = XLSX.utils.json_to_sheet(data, { header: columns });
    
    // Настраиваем ширину колонок
    const colWidths = columns.map(col => {
      const headerLen = col.length;
      const maxDataLen = Math.max(...rows.map(row => {
        const val = row[col];
        return val !== null && val !== undefined ? String(val).length : 0;
      }));
      return { wch: Math.max(headerLen, maxDataLen, 10) };
    });
    worksheet["!cols"] = colWidths;
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    
    XLSX.writeFile(workbook, `table_export_${Date.now()}.xls`);
  };

  // Экспорт в JSON
  const exportToJSON = () => {
    if (rows.length === 0) return;
    
    const jsonData = {
      query: sql,
      columns: columns,
      rows: rows,
      rowCount: rows.length,
      exportedAt: new Date().toISOString()
    };
    
    const jsonContent = JSON.stringify(jsonData, null, 2);
    downloadFile(jsonContent, `table_export_${Date.now()}.json`, "application/json");
  };

  // Экспорт в TXT (табличный формат)
  const exportToTXT = () => {
    if (rows.length === 0) return;
    
    const colWidths = columns.map(col => {
      const headerLen = col.length;
      const maxDataLen = Math.max(...rows.map(row => {
        const val = row[col];
        return val !== null && val !== undefined ? String(val).length : 0;
      }));
      return Math.max(headerLen, maxDataLen, 10);
    });
    
    const formatRow = (values: (string | number | null)[]) => {
      return values.map((val, i) => {
        const str = val !== null && val !== undefined ? String(val) : "";
        return str.padEnd(colWidths[i], " ");
      }).join(" | ");
    };
    
    const lines = [
      `SQL Query: ${sql}`,
      `Exported: ${new Date().toISOString()}`,
      "",
      formatRow(columns),
      "-".repeat(formatRow(columns).length),
      ...rows.map(row => formatRow(columns.map(col => row[col])))
    ];
    
    downloadFile(lines.join("\n"), `table_export_${Date.now()}.txt`, "text/plain");
  };

  // Экспорт в PDF (простой вариант через HTML)
  const exportToPDF = () => {
    if (rows.length === 0) return;
    
    // Создаем HTML таблицу
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h2 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .sql-info { background-color: #f0f0f0; padding: 10px; margin-bottom: 20px; border-radius: 4px; }
  </style>
</head>
<body>
  <h2>SQL Query Results</h2>
  <div class="sql-info">
    <strong>SQL Query:</strong> ${sql.replace(/</g, "&lt;").replace(/>/g, "&gt;")}<br>
    <strong>Exported:</strong> ${new Date().toISOString()}<br>
    <strong>Rows:</strong> ${rows.length}
  </div>
  <table>
    <thead>
      <tr>
        ${columns.map(col => `<th>${String(col).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rows.map(row => `
        <tr>
          ${columns.map(col => {
            const val = row[col];
            const displayVal = val !== null && val !== undefined ? String(val).replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
            return `<td>${displayVal}</td>`;
          }).join("")}
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>`;
    
    // Открываем в новом окне для печати/сохранения как PDF
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  // Экспорт в DOC (HTML формат, который Word откроет)
  const exportToDOC = () => {
    if (rows.length === 0) return;
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h2 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .sql-info { background-color: #f0f0f0; padding: 10px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h2>SQL Query Results</h2>
  <div class="sql-info">
    <strong>SQL Query:</strong> ${sql.replace(/</g, "&lt;").replace(/>/g, "&gt;")}<br>
    <strong>Exported:</strong> ${new Date().toISOString()}<br>
    <strong>Rows:</strong> ${rows.length}
  </div>
  <table>
    <thead>
      <tr>
        ${columns.map(col => `<th>${String(col).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rows.map(row => `
        <tr>
          ${columns.map(col => {
            const val = row[col];
            const displayVal = val !== null && val !== undefined ? String(val).replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
            return `<td>${displayVal}</td>`;
          }).join("")}
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>`;
    
    downloadFile(htmlContent, `table_export_${Date.now()}.doc`, "application/msword");
  };

  // Экспорт в DOCX (используем тот же HTML формат)
  const exportToDOCX = () => {
    exportToDOC(); // DOCX можно открыть как DOC в большинстве случаев
  };

  // Копирование в буфер обмена
  const copyToClipboard = () => {
    if (rows.length === 0) return;
    
    // Формируем CSV формат
    const headers = columns.join("\t");
    const dataRows = rows.map(row => 
      columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return "";
        // Экранируем табы и переносы строк
        return String(value).replace(/\t/g, " ").replace(/\n/g, " ");
      }).join("\t")
    );
    const csv = [headers, ...dataRows].join("\n");
    
    navigator.clipboard.writeText(csv);
    alert("Данные скопированы в буфер обмена!");
  };

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        downloadMenuRef.current &&
        !downloadMenuRef.current.contains(event.target as Node)
      ) {
        setShowDownloadMenu(false);
      }
    };

    if (showDownloadMenu) {
      // Используем небольшой таймаут, чтобы клик на кнопку не закрывал меню сразу
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 100);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showDownloadMenu]);

  // Обертка для экспорт функций - закрывает меню после выбора
  const handleExport = (exportFn: () => void) => {
    exportFn();
    setShowDownloadMenu(false);
  };

  return (
    <div
      ref={modalRef}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === modalRef.current) onClose(id);
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
          padding: "16px",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          width: `${size.width}%`,
          height: `${size.height}%`,
          maxWidth: "98vw",
          maxHeight: "98vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "12px",
          paddingBottom: "12px",
          borderBottom: "2px solid #d0d0d0"
        }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: "18px", 
            fontWeight: 600,
            color: "#1a1a1a"
          }}>
            📊 Результат SQL-запроса ({rows.length} строк)
          </h3>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {/* Выпадающее меню для экспорта */}
            <div 
              ref={downloadMenuRef}
              style={{ position: "relative", display: "inline-block" }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDownloadMenu(!showDownloadMenu);
                }}
                style={{
                  padding: "6px 12px",
                  fontSize: "13px",
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#218838"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#28a745"}
              >
                💾 Скачать {showDownloadMenu ? "▲" : "▼"}
              </button>
              {showDownloadMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: "4px",
                  backgroundColor: "white",
                  border: "1px solid #d0d0d0",
                  borderRadius: "4px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  zIndex: 1001,
                  minWidth: "150px",
                  padding: "4px 0",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(exportToSQL);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f0f0f0"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  📄 SQL
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(exportToCSV);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f0f0f0"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  📊 CSV
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(exportToXLSX);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f0f0f0"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  📗 XLSX
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(exportToXLS);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f0f0f0"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  📘 XLS
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(exportToJSON);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f0f0f0"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  📋 JSON
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(exportToPDF);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f0f0f0"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  📑 PDF
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(exportToDOC);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f0f0f0"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  📝 DOC
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(exportToDOCX);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f0f0f0"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  📄 DOCX
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(exportToTXT);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f0f0f0"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  📄 TXT
                </button>
              </div>
              )}
            </div>
            <button
              onClick={copyToClipboard}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                backgroundColor: "#0078d4",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: 500,
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#106ebe"}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#0078d4"}
            >
              📋 Копировать
            </button>
            {onMinimize && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {showMinimizeInput ? (
                  <>
                    <input
                      ref={minimizeInputRef}
                      type="text"
                      value={minimizeTabName}
                      onChange={(e) => setMinimizeTabName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          // Сохраняем значение перед вызовом
                          const currentValue = minimizeTabName.trim();
                          if (currentValue) {
                            // Вызываем handleMinimizeSubmit с сохраненным значением
                            const savedValue = currentValue;
                            setShowMinimizeInput(false);
                            setMinimizeTabName("");
                            if (onMinimize) {
                              console.log("Enter: вызываем onMinimize с именем:", savedValue);
                              onMinimize(id, savedValue);
                            }
                            setTimeout(() => {
                              isSubmittingRef.current = false;
                            }, 100);
                          } else {
                            handleMinimizeSubmit();
                          }
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowMinimizeInput(false);
                          setMinimizeTabName("");
                        }
                      }}
                      onBlur={(e) => {
                        // Не закрываем при потере фокуса, если фокус переходит на кнопку подтверждения
                        // Используем задержку, чтобы onClick кнопки успел сработать
                        setTimeout(() => {
                          if (showMinimizeInput) {
                            const activeElement = document.activeElement;
                            const isClickingButton = activeElement?.closest('button')?.textContent?.includes('✓') ||
                                                     activeElement?.closest('button')?.textContent?.includes('✖');
                            if (!isClickingButton && document.activeElement !== minimizeInputRef.current) {
                              // Если не кликаем на кнопку, отменяем
                              setShowMinimizeInput(false);
                              setMinimizeTabName("");
                            }
                          }
                        }, 200);
                      }}
                      placeholder="Введите имя вкладки"
                      autoFocus
                      style={{
                        padding: "6px 12px",
                        fontSize: "13px",
                        border: "1px solid #0078d4",
                        borderRadius: "4px",
                        outline: "none",
                        minWidth: "150px",
                      }}
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        // Предотвращаем потерю фокуса input при клике на кнопку
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Сохраняем значение перед вызовом
                        const currentValue = minimizeTabName.trim();
                        if (currentValue) {
                          // Вызываем onMinimize напрямую с сохраненным значением
                          const savedValue = currentValue;
                          setShowMinimizeInput(false);
                          setMinimizeTabName("");
                          if (onMinimize) {
                            console.log("Кнопка ✓: вызываем onMinimize с именем:", savedValue);
                            onMinimize(id, savedValue);
                          }
                          setTimeout(() => {
                            isSubmittingRef.current = false;
                          }, 100);
                        } else {
                          handleMinimizeSubmit();
                        }
                      }}
                      style={{
                        padding: "6px 12px",
                        fontSize: "13px",
                        backgroundColor: "#28a745",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#218838"}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#28a745"}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        setShowMinimizeInput(false);
                        setMinimizeTabName("");
                      }}
                      style={{
                        padding: "6px 12px",
                        fontSize: "13px",
                        backgroundColor: "#f3f3f3",
                        color: "#1a1a1a",
                        border: "1px solid #d0d0d0",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#e5e5e5"}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#f3f3f3"}
                    >
                      ✖
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      // Предотвращаем повторное открытие, если уже идет процесс сворачивания
                      if (isSubmittingRef.current) {
                        console.log("Кнопка Свернуть: уже идет процесс сворачивания");
                        return;
                      }
                      setShowMinimizeInput(true);
                      setMinimizeTabName("");
                      // Фокус на input после небольшой задержки
                      setTimeout(() => {
                        minimizeInputRef.current?.focus();
                      }, 50);
                    }}
                    disabled={isSubmittingRef.current}
                    style={{
                      padding: "6px 12px",
                      fontSize: "13px",
                      backgroundColor: isSubmittingRef.current ? "#d0d0d0" : "#f3f3f3",
                      color: "#1a1a1a",
                      border: "1px solid #d0d0d0",
                      borderRadius: "4px",
                      cursor: isSubmittingRef.current ? "not-allowed" : "pointer",
                      opacity: isSubmittingRef.current ? 0.6 : 1,
                    }}
                    onMouseOver={(e) => {
                      if (!isSubmittingRef.current) {
                        e.currentTarget.style.backgroundColor = "#e5e5e5";
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isSubmittingRef.current) {
                        e.currentTarget.style.backgroundColor = "#f3f3f3";
                      }
                    }}
                  >
                    🧩 Свернуть
                  </button>
                )}
              </div>
            )}
            <button
              onClick={() => onClose(id)}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                backgroundColor: "#d13438",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: 500,
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#c02a2e"}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#d13438"}
            >
              ✖ Закрыть
            </button>
          </div>
        </div>

        {/* SQL запрос */}
        <div style={{ 
          fontSize: "12px", 
          color: "#666",
          marginBottom: "12px",
          padding: "8px",
          backgroundColor: "#f9f9f9",
          borderRadius: "4px",
          fontFamily: "monospace",
          border: "1px solid #e0e0e0"
        }}>
          SQL: {sql}
        </div>

        {/* Таблица в стиле Excel */}
        <div 
          ref={tableContainerRef}
          style={{
            flex: 1,
            overflow: "auto",
            border: "1px solid #d0d0d0",
            backgroundColor: "#ffffff",
            position: "relative",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
              fontFamily: "Segoe UI, Arial, sans-serif",
            }}
          >
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr>
                {/* Колонка с номерами строк */}
                <th
                  style={{
                    backgroundColor: "#f2f2f2",
                    border: "1px solid #d0d0d0",
                    padding: "8px 12px",
                    textAlign: "center",
                    fontWeight: 600,
                    color: "#1a1a1a",
                    minWidth: "50px",
                    position: "sticky",
                    left: 0,
                    zIndex: 11,
                    boxShadow: "2px 0 2px rgba(0,0,0,0.1)",
                  }}
                >
                  #
                </th>
                {columns.map((col) => (
                  <th
                    key={col}
                    style={{
                      backgroundColor: "#f2f2f2",
                      border: "1px solid #d0d0d0",
                      padding: "8px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#1a1a1a",
                      whiteSpace: "nowrap",
                      minWidth: "120px",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      backgroundColor: i % 2 === 0 ? "#ffffff" : "#f9f9f9",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#e8f4f8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = i % 2 === 0 ? "#ffffff" : "#f9f9f9";
                    }}
                  >
                    {/* Номер строки */}
                    <td
                      style={{
                        backgroundColor: "#f2f2f2",
                        border: "1px solid #d0d0d0",
                        padding: "6px 12px",
                        textAlign: "center",
                        color: "#666",
                        fontWeight: 500,
                        position: "sticky",
                        left: 0,
                        zIndex: 1,
                        boxShadow: "2px 0 2px rgba(0,0,0,0.1)",
                      }}
                    >
                      {i + 1}
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col}
                        style={{
                          border: "1px solid #d0d0d0",
                          padding: "6px 12px",
                          color: "#1a1a1a",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "300px",
                        }}
                        title={row[col] !== null && row[col] !== undefined ? String(row[col]) : ""}
                      >
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : ""}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "#999",
                      fontSize: "14px",
                    }}
                  >
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

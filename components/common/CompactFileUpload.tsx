import React, { useRef } from "react";
import * as XLSX from "xlsx";

interface CompactFileUploadProps {
  onFileLoaded: (content: string, fileName: string) => void;
  onError?: (error: string) => void;
  uploadedFile: string | null;
}

const ALLOWED_TYPES = [".sql", ".csv", ".xlsx", ".xls", ".json", ".pdf", ".doc", ".docx", ".txt"];

export default function CompactFileUpload({ onFileLoaded, onError, uploadedFile }: CompactFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const validateFile = (file: File): boolean => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) {
      onError?.(`Неподдерживаемый тип файла. Разрешены: ${ALLOWED_TYPES.join(", ")}`);
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      onError?.("Файл слишком большой. Максимальный размер: 10MB");
      return false;
    }
    return true;
  };

  const readTextFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error("Ошибка чтения файла"));
      reader.readAsText(file, "UTF-8");
    });
  };

  const readCSV = async (file: File): Promise<string> => {
    const text = await readTextFile(file);
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length === 0) return "CSV файл пуст";
    const headers = lines[0].split(",").map(h => h.trim());
    const dataRows = lines.slice(1);
    let result = `CSV данные:\nКолонки (${headers.length}): ${headers.join(", ")}\nВсего строк данных: ${dataRows.length}\n\n`;
    const previewRows = Math.min(5, dataRows.length);
    result += `Примеры данных (${previewRows} из ${dataRows.length} строк):\n`;
    for (let i = 0; i < previewRows; i++) {
      const values = dataRows[i].split(",").map(v => v.trim());
      result += `  Строка ${i + 1}: ${JSON.stringify(Object.fromEntries(headers.map((h, idx) => [h, values[idx] || ""])))}\n`;
    }
    if (dataRows.length > previewRows) {
      result += `  ... и еще ${dataRows.length - previewRows} строк\n`;
    }
    return result;
  };

  const readJSON = async (file: File): Promise<string> => {
    const text = await readTextFile(file);
    try {
      const json = JSON.parse(text);
      return `JSON структура:\n${JSON.stringify(json, null, 2)}`;
    } catch {
      return text;
    }
  };

  const readExcel = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          let result = "Excel данные:\n";
          workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            result += `\nЛист "${sheetName}":\n`;
            if (jsonData.length > 0) {
              const headers = jsonData[0] as any[];
              result += `Колонки: ${headers.join(", ")}\n`;
              const previewRows = Math.min(5, jsonData.length - 1);
              result += `Примеры данных (${previewRows} из ${jsonData.length - 1} строк):\n`;
              for (let i = 1; i <= previewRows; i++) {
                result += `  Строка ${i}: ${JSON.stringify(jsonData[i])}\n`;
              }
            }
          });
          resolve(result);
        } catch (error) {
          reject(new Error(`Ошибка чтения Excel: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`));
        }
      };
      reader.onerror = () => reject(new Error("Ошибка чтения файла"));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateFile(file)) return;

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    let content = "";

    try {
      if ([".sql", ".txt"].includes(ext)) {
        content = await readTextFile(file);
      } else if (ext === ".csv") {
        content = await readCSV(file);
      } else if (ext === ".json") {
        content = await readJSON(file);
      } else if ([".xlsx", ".xls"].includes(ext)) {
        content = await readExcel(file);
      } else if ([".pdf", ".doc", ".docx"].includes(ext)) {
        onError?.("Обработка документов (PDF/DOC) будет добавлена в следующей версии");
        return;
      } else {
        content = await readTextFile(file);
      }
      onFileLoaded(content, file.name);
    } catch (error: any) {
      onError?.(error.message || "Ошибка обработки файла");
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".sql,.csv,.xlsx,.xls,.json,.pdf,.doc,.docx,.txt"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      <button
        onClick={handleClick}
        style={{
          width: "100%",
          padding: "10px 16px",
          background: uploadedFile ? "rgba(34, 211, 238, 0.1)" : "rgba(96, 165, 250, 0.1)",
          border: uploadedFile ? "1px solid rgba(34, 211, 238, 0.3)" : "1px solid rgba(96, 165, 250, 0.3)",
          borderRadius: "8px",
          color: uploadedFile ? "#22d3ee" : "#60a5fa",
          textDecoration: "none",
          fontSize: "14px",
          fontWeight: 500,
          textAlign: "center",
          transition: "all 0.2s",
          cursor: "pointer",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = uploadedFile ? "rgba(34, 211, 238, 0.2)" : "rgba(96, 165, 250, 0.2)";
          e.currentTarget.style.borderColor = uploadedFile ? "rgba(34, 211, 238, 0.5)" : "rgba(96, 165, 250, 0.5)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = uploadedFile ? "rgba(34, 211, 238, 0.1)" : "rgba(96, 165, 250, 0.1)";
          e.currentTarget.style.borderColor = uploadedFile ? "rgba(34, 211, 238, 0.3)" : "rgba(96, 165, 250, 0.3)";
        }}
      >
        {uploadedFile ? `📎 ${uploadedFile}` : "📎 Загрузить файл"}
      </button>
    </>
  );
}


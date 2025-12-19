import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";

interface FileUploadProps {
  onFileLoaded: (content: string, fileName: string, fileType: string) => void;
  onError?: (error: string) => void;
  acceptedTypes?: string[];
}

const ALLOWED_TYPES = [
  ".sql",
  ".csv",
  ".xlsx",
  ".xls",
  ".json",
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
];

export default function FileUpload({
  onFileLoaded,
  onError,
  acceptedTypes = ALLOWED_TYPES,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    type: string;
    size: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!acceptedTypes.includes(ext)) {
      onError?.(
        `Неподдерживаемый тип файла. Разрешены: ${acceptedTypes.join(", ")}`
      );
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      onError?.("Файл слишком большой. Максимальный размер: 10MB");
      return false;
    }
    return true;
  };

  const readTextFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = () => reject(new Error("Ошибка чтения файла"));
      reader.readAsText(file, "UTF-8");
    });
  };

  const readCSV = async (file: File): Promise<string> => {
    const text = await readTextFile(file);
    const lines = text.split("\n").filter(line => line.trim());
    
    if (lines.length === 0) {
      return "CSV файл пуст";
    }
    
    // Парсим заголовки
    const headers = lines[0].split(",").map(h => h.trim());
    const dataRows = lines.slice(1);
    
    let result = `CSV данные:\n`;
    result += `Колонки (${headers.length}): ${headers.join(", ")}\n`;
    result += `Всего строк данных: ${dataRows.length}\n\n`;
    
    // Показываем первые несколько строк для примера
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
          workbook.SheetNames.forEach((sheetName, idx) => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            result += `\nЛист "${sheetName}":\n`;
            if (jsonData.length > 0) {
              // Показываем заголовки (первая строка)
              const headers = jsonData[0] as any[];
              result += `Колонки: ${headers.join(", ")}\n`;
              
              // Показываем первые несколько строк для примера
              const previewRows = Math.min(5, jsonData.length - 1);
              result += `Примеры данных (${previewRows} из ${jsonData.length - 1} строк):\n`;
              for (let i = 1; i <= previewRows; i++) {
                result += `  Строка ${i}: ${JSON.stringify(jsonData[i])}\n`;
              }
              if (jsonData.length > previewRows + 1) {
                result += `  ... и еще ${jsonData.length - previewRows - 1} строк\n`;
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

  const handleFile = async (file: File) => {
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
        // Документы требуют специальной библиотеки
        onError?.(
          "Обработка документов (PDF/DOC) будет добавлена в следующей версии"
        );
        return;
      } else {
        content = await readTextFile(file);
      }

      setUploadedFile({
        name: file.name,
        type: ext,
        size: file.size,
      });

      onFileLoaded(content, file.name, ext);
    } catch (error) {
      onError?.(
        `Ошибка обработки файла: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`
      );
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? "#22d3ee" : "#1f2937"}`,
          borderRadius: 12,
          padding: 24,
          textAlign: "center",
          cursor: "pointer",
          background: isDragging ? "#0b1220" : "transparent",
          transition: "all 0.2s ease",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(",")}
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        <div style={{ color: "#e5e7eb" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {uploadedFile ? "Файл загружен" : "Перетащите файл или нажмите для выбора"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            {acceptedTypes.join(", ").toUpperCase()}
          </div>
          {uploadedFile && (
            <div
              style={{
                marginTop: 12,
                padding: 8,
                background: "#10b98120",
                borderRadius: 8,
                border: "1px solid #10b98150",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {uploadedFile.name}
              </div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                {uploadedFile.type.toUpperCase()} • {formatFileSize(uploadedFile.size)}
              </div>
            </div>
          )}
        </div>
      </div>
      {uploadedFile && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setUploadedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          style={{
            marginTop: 8,
            background: "#ef444420",
            color: "#fecaca",
            border: "1px solid #ef444460",
            borderRadius: 8,
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          ✕ Удалить файл
        </button>
      )}
    </div>
  );
}

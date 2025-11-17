import React from "react";

interface Props {
  fields: string[];
  availableFields?: string[];
  onChange: (fields: string[]) => void;
}

export default function FieldsSelector({ fields, availableFields = [], onChange }: Props) {
  const addField = () => onChange([...fields, ""]);
  const removeField = (index: number) => onChange(fields.filter((_, i) => i !== index));

  const updateField = (index: number, value: string) => {
    const updated = [...fields];
    updated[index] = value;
    onChange(updated);
  };

  // Локальная замена старого Button — теперь полностью inline, без конфликтов
  const Button = ({
    children,
    variant = "default",
    onClick,
  }: {
    children: React.ReactNode;
    variant?: "default" | "danger";
    onClick?: () => void;
  }) => {
    const base =
      "px-3 py-1.5 rounded-md text-sm font-medium transition-all shadow-sm";
    const variants = {
      default:
        "bg-gradient-to-r from-cyan-500 to-blue-500 text-[#0b1220] hover:brightness-110 shadow-cyan-500/20",
      danger:
        "bg-transparent border border-red-500/50 text-red-400 hover:border-red-400 hover:text-red-300",
    };
    return (
      <button onClick={onClick} className={`${base} ${variants[variant]}`}>
        {children}
      </button>
    );
  };

  return (
    <div className="mt-3">
      <label className="block mb-1 text-gray-300 text-sm">📋 SELECT поля</label>

      {fields.map((field, i) => (
        <div key={i} className="flex flex-wrap gap-2 mb-2 items-center">
          <select
            value={field}
            onChange={(e) => updateField(i, e.target.value)}
            className="sql-input flex-1"
          >
            <option value="">— выбрать поле —</option>
            {availableFields.map((col) => (
              <option key={col}>{col}</option>
            ))}
          </select>

          <Button variant="danger" onClick={() => removeField(i)}>
            ✖
          </Button>
        </div>
      ))}

      <Button onClick={addField}>➕ Добавить поле</Button>
    </div>
  );
}

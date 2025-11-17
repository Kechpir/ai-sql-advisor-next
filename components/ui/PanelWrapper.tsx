import React from "react";

interface Props {
  title?: string;
  children: React.ReactNode;
}

export function PanelWrapper({ title, children }: Props) {
  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 mb-6 shadow-md shadow-black/20">
      {title && (
        <h2 className="text-lg font-semibold mb-4 text-cyan-300 flex items-center gap-2">
          {title}
        </h2>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

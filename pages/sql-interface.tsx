import React from "react";
import SqlInterfacePanel from "@/components/SqlInterfacePanel";

export default function SqlInterface() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8">
      <SqlInterfacePanel />
    </div>
  );
}

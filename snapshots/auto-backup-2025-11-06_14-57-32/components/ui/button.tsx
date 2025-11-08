import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "ghost";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  className = "",
  ...props
}) => {
  const base =
    "px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none shadow-[0_0_8px_rgba(0,255,255,0.3)]";

  const variants = {
    primary:
      "bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_10px_#00ffff80]",
    danger: "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_10px_#ff333380]",
    ghost:
      "bg-transparent hover:bg-[#1a2335] text-cyan-300 border border-cyan-500/30",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

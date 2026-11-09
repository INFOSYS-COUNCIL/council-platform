import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary:
    "bg-coral-700 text-white shadow-sm hover:bg-coral-800 dark:bg-coral-400 dark:text-zinc-950 dark:hover:bg-coral-300",
  secondary:
    "border border-zinc-300 bg-white shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
};

// focus 테두리와 비활성 표시를 모든 버튼에 똑같이 적용한다.
export function Button({
  variant = "primary",
  type = "button",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary:
    "bg-accent text-on-accent hover:bg-coral-800 dark:hover:bg-coral-300",
  secondary:
    "border border-border-input bg-surface hover:bg-zinc-50 dark:hover:bg-zinc-800",
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
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

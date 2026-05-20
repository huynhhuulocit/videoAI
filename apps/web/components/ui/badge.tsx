import type { PropsWithChildren } from "react";

const variants = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-sky-50 text-sky-700"
};

export function Badge({
  children,
  variant = "neutral"
}: PropsWithChildren<{ variant?: keyof typeof variants }>) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

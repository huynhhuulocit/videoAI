import type { PropsWithChildren, ReactNode } from "react";

type CardProps = PropsWithChildren<{
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
}>;

export function Card({ title, action, children, className = "" }: CardProps) {
  return (
    <section className={`rounded-lg border border-border bg-white p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

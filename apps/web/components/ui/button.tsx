import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  HTMLAttributeAnchorTarget,
  PropsWithChildren,
} from "react";

const variants = {
  primary:
    "border border-primary bg-primary text-primary-foreground shadow-sm hover:bg-sky-600 focus:ring-sky-200",
  secondary:
    "border border-border bg-white text-foreground shadow-sm hover:bg-muted focus:ring-sky-200",
  destructive:
    "border border-red-600 bg-red-600 text-white shadow-sm hover:bg-red-700 focus:ring-red-200",
  ghost:
    "border border-transparent text-muted-foreground shadow-none hover:bg-muted hover:text-foreground focus:ring-sky-200",
};

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement>
> & {
  variant?: keyof typeof variants;
};

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

type LinkButtonProps = PropsWithChildren<{
  href: string;
  variant?: keyof typeof variants;
  className?: string;
  target?: HTMLAttributeAnchorTarget;
  rel?: string;
}>;

export function LinkButton({
  className = "",
  variant = "primary",
  href,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={`inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition focus:outline-none focus:ring-2 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

"use client";

import type { ReactNode, TextareaHTMLAttributes } from "react";
import { TextareaWithCounter } from "./textarea-with-counter";

type MasterPromptFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  id: string;
  label: ReactNode;
  help?: ReactNode;
};

export function MasterPromptField({
  className = "",
  help,
  id,
  label,
  ...props
}: MasterPromptFieldProps) {
  return (
    <div className="rounded-lg border border-sky-100 bg-sky-50/80 p-3">
      <label className="text-sm font-medium text-sky-950" htmlFor={id}>
        {label}
      </label>
      {help ? <p className="mt-1 text-xs leading-5 text-sky-800/80">{help}</p> : null}
      <TextareaWithCounter
        id={id}
        className={`mt-2 w-full rounded-md border border-sky-200 bg-white/95 p-3 font-mono text-sm leading-6 text-foreground outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-sky-50 disabled:text-muted-foreground ${className}`}
        {...props}
      />
    </div>
  );
}

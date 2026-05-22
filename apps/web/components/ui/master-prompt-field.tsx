"use client";

import type { ReactNode, TextareaHTMLAttributes } from "react";
import { TextareaWithCounter, type TextareaPlaceholderSuggestion } from "./textarea-with-counter";

type MasterPromptFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  id: string;
  label: ReactNode;
  help?: ReactNode;
  placeholderSuggestions?: TextareaPlaceholderSuggestion[];
};

export function MasterPromptField({
  className = "",
  help,
  id,
  label,
  placeholderSuggestions = [],
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
        placeholderSuggestions={placeholderSuggestions}
        {...props}
      />
      {placeholderSuggestions.length > 0 ? (
        <div className="mt-3 rounded-md border border-sky-100 bg-white/70 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-900">
            Available placeholders
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {placeholderSuggestions.map((suggestion) => (
              <div key={suggestion.token} className="min-w-0 rounded-md bg-sky-50 px-2 py-1.5">
                <code className="text-xs font-semibold text-sky-950">{suggestion.token}</code>
                <p className="mt-0.5 text-xs leading-5 text-sky-800/80">{suggestion.description}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-sky-800/80">
            Type {"{"} to search placeholders, then click a suggestion or press Enter.
          </p>
        </div>
      ) : null}
    </div>
  );
}

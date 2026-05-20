"use client";

import { X } from "lucide-react";

export type AiDebugDialogData = {
  title: string;
  help: string;
  value: unknown;
};

export function formatAiDebugValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

type AiDebugDialogProps = {
  data: AiDebugDialogData | null;
  closeLabel: string;
  onClose: () => void;
};

export function AiDebugDialog({ data, closeLabel, onClose }: AiDebugDialogProps) {
  if (!data) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-debug-title"
        className="flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 id="ai-debug-title" className="text-base font-semibold text-foreground">
              {data.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{data.help}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-50">
            {formatAiDebugValue(data.value)}
          </pre>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

export type FeedbackToastState = {
  message: string;
  type: "success" | "error";
} | null;

export function useFeedbackToast(timeoutMs = 2000) {
  const [toast, setToast] = useState<FeedbackToastState>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), timeoutMs);
    return () => window.clearTimeout(timeout);
  }, [toast, timeoutMs]);

  return {
    clearToast: () => setToast(null),
    showToast: setToast,
    toast,
  };
}

export function FeedbackToast({
  onClose,
  toast,
}: {
  onClose: () => void;
  toast: FeedbackToastState;
}) {
  if (!toast) {
    return null;
  }

  const isSuccess = toast.type === "success";
  const Icon = isSuccess ? CheckCircle2 : XCircle;

  return (
    <div
      className="fixed right-5 top-5 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-border bg-white p-4 shadow-xl"
      role={isSuccess ? "status" : "alert"}
    >
      <div className="flex items-start gap-3">
        <Icon
          size={20}
          className={isSuccess ? "mt-0.5 shrink-0 text-emerald-600" : "mt-0.5 shrink-0 text-red-600"}
        />
        <div className="min-w-0 flex-1">
          <div className={isSuccess ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-700"}>
            {isSuccess ? "Success" : "Error"}
          </div>
          <div className="mt-1 text-sm leading-5 text-foreground">{toast.message}</div>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
          aria-label="Close notification"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

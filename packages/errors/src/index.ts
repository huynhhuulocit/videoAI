import type { ApiError, ApiErrorCode, ApiFailure } from "@videoai/contracts";

export class VideoAiError extends Error {
  readonly code: ApiErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "VideoAiError";
    this.code = code;
    this.details = details;
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {})
    };
  }
}

export function toFailure(error: unknown, requestId?: string): ApiFailure {
  if (error instanceof VideoAiError) {
    return {
      error: error.toApiError(),
      meta: { requestId }
    };
  }

  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected internal error"
    },
    meta: { requestId }
  };
}

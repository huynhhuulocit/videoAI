import type { ApiSuccess } from "@videoai/contracts";

export function ok<T>(data: T, requestId = "dev-request"): ApiSuccess<T> {
  return {
    data,
    meta: { requestId }
  };
}

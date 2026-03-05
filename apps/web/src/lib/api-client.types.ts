export interface ParsedApiError {
  readonly code: string;
  readonly details: unknown;
  readonly message: string;
  readonly requestId: string;
}

export interface OkJson {
  json: unknown;
  ok: true;
}

export interface FailedJson {
  error: unknown;
  ok: false;
}

export interface OkResponse {
  ok: true;
  response: Response;
}

export interface FailedResponse {
  error: unknown;
  ok: false;
}

export type ApiResult<T> =
  | { ok: true; requestId: string; data: T }
  | {
      code?: string;
      message?: string;
      ok: false;
      requestId: string;
      reason: "aborted" | "http" | "schema" | "network";
      status?: number;
      details?: unknown;
    };

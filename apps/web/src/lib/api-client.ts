import { ApiHeaders } from "@map-migration/contracts";
import { createRequestId } from "@map-migration/ops";

export type ApiResult<T> =
  | { ok: true; requestId: string; data: T }
  | {
      ok: false;
      requestId: string;
      reason: "aborted" | "http" | "schema" | "network";
      status?: number;
      details?: unknown;
    };

interface SafeParseSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown };
}

interface FailedResponse {
  error: unknown;
  ok: false;
}

interface OkResponse {
  ok: true;
  response: Response;
}

interface FailedJson {
  error: unknown;
  ok: false;
}

interface OkJson {
  json: unknown;
  ok: true;
}

async function safeFetch(url: string, init: RequestInit): Promise<FailedResponse | OkResponse> {
  try {
    const response = await fetch(url, init);
    return { ok: true, response };
  } catch (error) {
    return { ok: false, error };
  }
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  return Reflect.get(error, "name") === "AbortError";
}

async function safeJson(response: Response): Promise<FailedJson | OkJson> {
  try {
    const json = await response.json();
    return { ok: true, json };
  } catch (error) {
    return { ok: false, error };
  }
}

async function readHttpErrorDetails(response: Response): Promise<unknown> {
  const jsonResult = await safeJson(response.clone());
  if (jsonResult.ok) {
    return jsonResult.json;
  }

  try {
    const text = await response.text();
    if (text.trim().length > 0) {
      return text;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export async function apiGetJson<T>(
  url: string,
  schema: SafeParseSchema<T>,
  init: RequestInit = {},
  options: { requestIdPrefix?: string } = {}
): Promise<ApiResult<T>> {
  const generatedRequestId = createRequestId(options.requestIdPrefix ?? "web");

  const headers = new Headers(init.headers);
  headers.set(ApiHeaders.requestId, generatedRequestId);

  const fetchResult = await safeFetch(url, { ...init, headers });
  if (!fetchResult.ok) {
    if (isAbortError(fetchResult.error)) {
      return {
        ok: false,
        requestId: generatedRequestId,
        reason: "aborted",
        details: fetchResult.error,
      };
    }

    return {
      ok: false,
      requestId: generatedRequestId,
      reason: "network",
      details: fetchResult.error,
    };
  }
  const { response } = fetchResult;

  const requestId = response.headers.get(ApiHeaders.requestId) ?? generatedRequestId;

  if (!response.ok) {
    const details = await readHttpErrorDetails(response);
    return { ok: false, requestId, reason: "http", status: response.status, details };
  }

  const jsonResult = await safeJson(response);
  if (!jsonResult.ok) {
    return { ok: false, requestId, reason: "schema", details: jsonResult.error };
  }
  const { json } = jsonResult;

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, requestId, reason: "schema", details: parsed.error };
  }

  return { ok: true, requestId, data: parsed.data };
}

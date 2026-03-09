import { ApiHeaders } from "@map-migration/contracts";

interface BuildApiRequestInitOptions {
  readonly body?: BodyInit | null | undefined;
  readonly headers?: HeadersInit | undefined;
  readonly method?: string | undefined;
  readonly signal?: AbortSignal | undefined;
}

interface BuildJsonPostRequestInitOptions {
  readonly body: unknown;
  readonly headers?: HeadersInit | undefined;
  readonly signal?: AbortSignal | undefined;
}

function normalizeOptionalHeaderValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function toHeadersRecord(headers: HeadersInit | undefined): Record<string, string> {
  const headersRecord: Record<string, string> = {};
  new Headers(headers).forEach((value, name) => {
    headersRecord[name] = value;
  });
  return headersRecord;
}

export function buildApiRequestInit(options: BuildApiRequestInitOptions = {}): RequestInit {
  const requestInit: RequestInit = {};

  if (typeof options.method === "string") {
    requestInit.method = options.method;
  }

  if (typeof options.body !== "undefined") {
    requestInit.body = options.body;
  }

  if (typeof options.headers !== "undefined") {
    requestInit.headers = toHeadersRecord(options.headers);
  }

  if (typeof options.signal !== "undefined") {
    requestInit.signal = options.signal;
  }

  return requestInit;
}

export function buildJsonPostRequestInit(options: BuildJsonPostRequestInitOptions): RequestInit {
  return buildApiRequestInit({
    body: JSON.stringify(options.body),
    headers: {
      "content-type": "application/json",
      ...toHeadersRecord(options.headers),
    },
    method: "POST",
    signal: options.signal,
  });
}

export function withParcelIngestionRunIdHeader(
  requestInit: RequestInit,
  expectedParcelIngestionRunId: string | null | undefined
): RequestInit {
  const normalizedParcelIngestionRunId = normalizeOptionalHeaderValue(expectedParcelIngestionRunId);
  if (normalizedParcelIngestionRunId === null) {
    return requestInit;
  }

  return {
    ...requestInit,
    headers: {
      ...toHeadersRecord(requestInit.headers),
      [ApiHeaders.parcelIngestionRunId]: normalizedParcelIngestionRunId,
    },
  };
}

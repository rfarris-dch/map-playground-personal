import type { DiagnosticEvent, DiagnosticSeverity, DiagnosticSourceMode } from "./index.types";
export type { DiagnosticEvent, DiagnosticSeverity, DiagnosticSourceMode } from "./index.types";

export const REQUEST_ID_MAX_LENGTH = 128;
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

export function createRequestId(prefix = "req"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${rand}`;
}

export function normalizeRequestIdHeader(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > REQUEST_ID_MAX_LENGTH) {
    return null;
  }

  if (!REQUEST_ID_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

export function createDiagnosticEvent(
  sourceMode: DiagnosticSourceMode,
  code: string,
  message: string,
  severity: DiagnosticSeverity = "info"
): DiagnosticEvent {
  return {
    requestId: createRequestId(),
    timestamp: new Date().toISOString(),
    sourceMode,
    code,
    message,
    severity,
  };
}

import type { DiagnosticEvent, DiagnosticSeverity, DiagnosticSourceMode } from "./index.types";

export type { DiagnosticEvent, DiagnosticSeverity, DiagnosticSourceMode } from "./index.types";

export function createRequestId(prefix = "req"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${rand}`;
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

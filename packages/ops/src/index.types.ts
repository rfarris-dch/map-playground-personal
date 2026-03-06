export interface DiagnosticEvent {
  code: string;
  message: string;
  requestId: string;
  severity: DiagnosticSeverity;
  sourceMode: DiagnosticSourceMode;
  timestamp: string;
}

export type DiagnosticSourceMode = string;

export type DiagnosticSeverity = "info" | "warn" | "error";

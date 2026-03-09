export type DiagnosticSeverity = "info" | "warning" | "error";

export type DiagnosticSourceMode = "fixture" | "live";

export interface DiagnosticEvent {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly severity: DiagnosticSeverity;
  readonly sourceMode: DiagnosticSourceMode;
  readonly timestamp: string;
}

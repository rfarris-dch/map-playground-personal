import type { SourceMode } from "@map-migration/contracts";

export interface DiagnosticEvent {
  code: string;
  message: string;
  requestId: string;
  severity: DiagnosticSeverity;
  sourceMode: SourceMode;
  timestamp: string;
}

export type DiagnosticSeverity = "info" | "warn" | "error";

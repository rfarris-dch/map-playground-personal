import type { DuckDbRequiredExtension } from "./batch-artifact-layout.types";

export interface DuckDbBootstrapOptions {
  readonly extensions?: readonly DuckDbRequiredExtension[];
  readonly includeInstallStatements?: boolean;
}

export interface OutputCaptureState {
  capturedBytes: number;
  output: string;
  truncated: boolean;
}

export interface ReadStreamOptions {
  readonly onLine?: (line: string) => void;
}

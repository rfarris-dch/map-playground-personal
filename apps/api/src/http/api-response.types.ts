export interface JsonErrorArgs extends ErrorEnvelopeArgs {
  readonly httpStatus: number;
}

export interface ErrorEnvelopeArgs {
  readonly code: string;
  readonly details?: unknown;
  readonly message: string;
  readonly requestId: string;
}

export interface JsonErrorArgs extends ErrorEnvelopeArgs {
  readonly httpStatus: number;
}

export interface ErrorEnvelopeArgs {
  readonly category?: string | undefined;
  readonly code: string;
  readonly details?: unknown;
  readonly message: string;
  readonly requestId: string;
  readonly subtype?: string | undefined;
}

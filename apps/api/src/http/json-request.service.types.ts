export type ReadJsonBodyResult = ReadJsonBodySuccess | ReadJsonBodyFailure;

export interface ReadJsonBodyFailure {
  readonly ok: false;
  readonly response: Response;
}

export interface ReadJsonBodySuccess {
  readonly ok: true;
  readonly value: unknown;
}

export interface ReadJsonBodyArgs {
  readonly invalidJsonMessage: string;
  readonly requestId: string;
}

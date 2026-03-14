export interface BunSqlQuery<TValue> extends Promise<TValue> {
  cancel(): BunSqlQuery<TValue>;
  execute(): BunSqlQuery<TValue>;
}

export interface BunSqlClient {
  begin<TValue>(options: string, fn: (sql: BunSqlClient) => Promise<TValue>): Promise<TValue>;
  close(options?: { readonly timeout?: number }): Promise<void>;
  reserve(): Promise<BunReservedSqlClient>;
  unsafe<TValue = unknown>(
    query: string,
    params?: ReadonlyArray<number | string | readonly string[]>
  ): BunSqlQuery<TValue>;
  <TValue = unknown>(
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): BunSqlQuery<TValue>;
}

export interface BunReservedSqlClient extends BunSqlClient {
  release(): void;
}

export interface PostgresConnectionState {
  sqlClientPromise: Promise<BunSqlClient> | null;
}

export interface PostgresConnectionState {
  sqlClientPromise: Promise<BunSqlClient> | null;
}

export interface BunSqlClient {
  close(): Promise<void>;
  unsafe<T extends object>(query: string, params?: ReadonlyArray<number | string>): Promise<T[]>;
}

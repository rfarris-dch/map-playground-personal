import type { BunSqlClient } from "./postgres.types";

declare const Bun: {
  sql: {
    close(): Promise<void>;
    unsafe<T extends object>(query: string, params?: ReadonlyArray<number | string>): Promise<T[]>;
  };
};

const CONNECTION_CLOSED_RE = /connection closed/i;
const POSTGRES_READY_QUERY = "select 1 as db_ready";

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (connectionString) {
    return connectionString;
  }

  throw new Error(
    "Missing DATABASE_URL or POSTGRES_URL. Load environment variables before starting @map-migration/api."
  );
}

function getSqlClient(): BunSqlClient {
  getConnectionString();
  return Bun.sql;
}

function isConnectionClosedError(error: unknown): boolean {
  if (error instanceof Error) {
    return CONNECTION_CLOSED_RE.test(error.message);
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  const message = Reflect.get(error, "message");
  return typeof message === "string" && CONNECTION_CLOSED_RE.test(message);
}

function runQueryWithClient<T extends object>(
  sqlClient: BunSqlClient,
  text: string,
  values: ReadonlyArray<number | string>
): Promise<T[]> {
  return sqlClient.unsafe<T>(text, values);
}

async function runQueryWithReconnect<T extends object>(
  sqlClient: BunSqlClient,
  text: string,
  values: ReadonlyArray<number | string>
): Promise<T[]> {
  try {
    return await runQueryWithClient<T>(sqlClient, text, values);
  } catch (error) {
    if (!isConnectionClosedError(error)) {
      throw error;
    }

    return runQueryWithClient<T>(getSqlClient(), text, values);
  }
}

export function runQuery<T extends object>(
  text: string,
  values: ReadonlyArray<number | string>
): Promise<T[]> {
  const sqlClient = getSqlClient();
  return runQueryWithReconnect<T>(sqlClient, text, values);
}

export async function assertPostgresReady(): Promise<void> {
  const sqlClient = getSqlClient();
  await runQueryWithReconnect<{ readonly db_ready: number }>(sqlClient, POSTGRES_READY_QUERY, []);
}

export async function closePostgresPool(): Promise<void> {
  await Bun.sql.close();
}

import { parsePositiveIntFlag } from "@/config/env-parsing.service";
import { readApiRequestContextStorage } from "@/http/api-request-context-storage.service";
import type { BunReservedSqlClient, BunSqlClient } from "./postgres.types";

export type SqlParameterValue = number | string | readonly string[];

declare const Bun: {
  sql: BunSqlClient;
};

const CONNECTION_CLOSED_RE = /connection closed/i;
const POSTGRES_READY_QUERY = "select 1 as db_ready";
const MAX_CONCURRENT_QUERIES = parsePositiveIntFlag(process.env.API_DB_MAX_CONCURRENT_QUERIES, 8);

let activeQueries = 0;
const queryQueue: Array<() => void> = [];

function acquireQuerySlot(): Promise<void> {
  if (activeQueries < MAX_CONCURRENT_QUERIES) {
    activeQueries++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    queryQueue.push(() => {
      activeQueries++;
      resolve();
    });
  });
}

function releaseQuerySlot(): void {
  const next = queryQueue.shift();
  if (next) {
    next();
  } else {
    activeQueries--;
  }
}
const DEFAULT_DB_STATEMENT_TIMEOUT_MS = parsePositiveIntFlag(
  process.env.API_DB_STATEMENT_TIMEOUT_MS,
  180_000
);
const DEFAULT_DB_LOCK_TIMEOUT_MS = parsePositiveIntFlag(process.env.API_DB_LOCK_TIMEOUT_MS, 5000);

export interface RunQueryOptions {
  readonly lockTimeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly statementTimeoutMs?: number;
}

interface ResolvedRunQueryOptions {
  readonly lockTimeoutMs: number;
  readonly signal: AbortSignal | null;
  readonly statementTimeoutMs: number;
}

function noop(): void {
  /* ignored */
}

function sanitizeTimeoutMs(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

function renderSetLocalTimeoutSql(
  settingName: "lock_timeout" | "statement_timeout",
  value: number
): string {
  return `SET LOCAL ${settingName} = ${String(sanitizeTimeoutMs(value, settingName === "lock_timeout" ? DEFAULT_DB_LOCK_TIMEOUT_MS : DEFAULT_DB_STATEMENT_TIMEOUT_MS))}`;
}

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

export function isConnectionClosedError(error: unknown): boolean {
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
  values: readonly SqlParameterValue[],
  options: ResolvedRunQueryOptions
): Promise<T[]> {
  return sqlClient.reserve().then(async (reserved: BunReservedSqlClient) => {
    try {
      return await runQueryWithReservedClient(reserved, text, values, options);
    } finally {
      reserved.release();
    }
  });
}

function resolveRunQueryOptions(options: RunQueryOptions | undefined): ResolvedRunQueryOptions {
  const requestContext = readApiRequestContextStorage();

  return {
    lockTimeoutMs: sanitizeTimeoutMs(
      options?.lockTimeoutMs ?? DEFAULT_DB_LOCK_TIMEOUT_MS,
      DEFAULT_DB_LOCK_TIMEOUT_MS
    ),
    signal: options?.signal ?? requestContext?.signal ?? null,
    statementTimeoutMs: sanitizeTimeoutMs(
      options?.statementTimeoutMs ?? DEFAULT_DB_STATEMENT_TIMEOUT_MS,
      DEFAULT_DB_STATEMENT_TIMEOUT_MS
    ),
  };
}

function attachAbortHandler<TValue extends object[]>(
  query: Promise<TValue> & { cancel(): unknown },
  signal: AbortSignal | null
): () => void {
  if (signal === null) {
    return noop;
  }

  const cancel = () => {
    query.cancel();
  };

  if (signal.aborted) {
    cancel();
    return noop;
  }

  signal.addEventListener("abort", cancel, { once: true });
  return () => {
    signal.removeEventListener("abort", cancel);
  };
}

function runQueryWithReservedClient<T extends object>(
  reserved: BunReservedSqlClient,
  text: string,
  values: readonly SqlParameterValue[],
  options: ResolvedRunQueryOptions
): Promise<T[]> {
  return reserved.begin("read only", async (sql: BunSqlClient) => {
    await sql
      .unsafe(renderSetLocalTimeoutSql("statement_timeout", options.statementTimeoutMs))
      .execute();
    await sql.unsafe(renderSetLocalTimeoutSql("lock_timeout", options.lockTimeoutMs)).execute();
    const query = sql.unsafe<T[]>(text, [...values]).execute();
    const detachAbortHandler = attachAbortHandler(query, options.signal);

    try {
      return await query;
    } finally {
      detachAbortHandler();
    }
  });
}

async function runQueryWithReconnect<T extends object>(
  sqlClient: BunSqlClient,
  text: string,
  values: readonly SqlParameterValue[],
  options: ResolvedRunQueryOptions
): Promise<T[]> {
  try {
    return await runQueryWithClient<T>(sqlClient, text, values, options);
  } catch (error) {
    if (!isConnectionClosedError(error)) {
      throw error;
    }

    return runQueryWithClient<T>(getSqlClient(), text, values, options);
  }
}

export async function runQuery<T extends object>(
  text: string,
  values: readonly SqlParameterValue[],
  options?: RunQueryOptions
): Promise<T[]> {
  await acquireQuerySlot();
  try {
    const sqlClient = getSqlClient();
    return await runQueryWithReconnect<T>(sqlClient, text, values, resolveRunQueryOptions(options));
  } finally {
    releaseQuerySlot();
  }
}

export async function assertPostgresReady(): Promise<void> {
  const sqlClient = getSqlClient();
  await runQueryWithReconnect<{ readonly db_ready: number }>(
    sqlClient,
    POSTGRES_READY_QUERY,
    [],
    resolveRunQueryOptions(undefined)
  );
}

export async function closePostgresPool(): Promise<void> {
  await Bun.sql.close();
}

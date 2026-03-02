declare const Bun: {
  sql: {
    connect(url: string): Promise<{
      close(): Promise<void>;
      unsafe<T extends object>(
        query: string,
        params?: ReadonlyArray<number | string>
      ): Promise<T[]>;
    }>;
    close(): Promise<void>;
    unsafe<T extends object>(query: string, params?: ReadonlyArray<number | string>): Promise<T[]>;
  };
};

type BunSqlClient = Awaited<ReturnType<typeof Bun.sql.connect>>;

interface PostgresConnectionState {
  sqlClientPromise: Promise<BunSqlClient> | null;
}

const postgresConnectionState: PostgresConnectionState = {
  sqlClientPromise: null,
};

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (connectionString) {
    return connectionString;
  }

  throw new Error(
    "Missing DATABASE_URL or POSTGRES_URL. Load environment variables before starting @map-migration/api."
  );
}

function getSqlClient(): Promise<BunSqlClient> {
  if (!postgresConnectionState.sqlClientPromise) {
    const connectionString = getConnectionString();
    postgresConnectionState.sqlClientPromise = Bun.sql
      .connect(connectionString)
      .catch((error: unknown) => {
        postgresConnectionState.sqlClientPromise = null;
        throw error;
      });
  }

  const { sqlClientPromise } = postgresConnectionState;
  if (!sqlClientPromise) {
    throw new Error("Failed to initialize Postgres connection.");
  }

  return sqlClientPromise;
}

export async function runQuery<T extends object>(
  text: string,
  values: ReadonlyArray<number | string>
): Promise<T[]> {
  const sqlClient = await getSqlClient();
  return sqlClient.unsafe<T>(text, values);
}

export async function closePostgresPool(): Promise<void> {
  const { sqlClientPromise } = postgresConnectionState;
  if (!sqlClientPromise) {
    return;
  }

  const sqlClient = await sqlClientPromise;
  await sqlClient.close();
  postgresConnectionState.sqlClientPromise = null;
}

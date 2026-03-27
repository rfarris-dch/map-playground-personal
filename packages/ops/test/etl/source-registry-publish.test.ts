import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolveProjectRootFromFileUrl } from "../../src/etl/project-paths";
import {
  generateSourceRegistryVersion,
  loadSourceRegistryEnvFileIfPresent,
  readSourceRegistrySeedBundle,
  resolveSourceRegistryAccessStatus,
} from "../../src/etl/source-registry-publish";

const projectRoot = resolveProjectRootFromFileUrl(import.meta.url, 4);

function runCommand(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv
): { readonly exitCode: number; readonly stderr: string; readonly stdout: string } {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });

  return {
    exitCode: result.status ?? 1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

function expectCommandSuccess(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv
): string {
  const result = runCommand(command, args, env);
  if (result.exitCode !== 0) {
    throw new Error(
      [`Command failed: ${command} ${args.join(" ")}`, result.stdout.trim(), result.stderr.trim()]
        .filter((part) => part.length > 0)
        .join("\n")
    );
  }

  return result.stdout.trim();
}

function readScalarQuery(databaseUrl: string, sql: string): string {
  return expectCommandSuccess(
    "psql",
    [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-c", sql],
    {}
  );
}

function readIntegerQuery(databaseUrl: string, sql: string): number {
  const value = readScalarQuery(databaseUrl, sql);
  return Number.parseInt(value, 10);
}

let testDatabaseUrl = "";
let registryBackupSchemaName = "";

beforeAll(async () => {
  const env: NodeJS.ProcessEnv = {};
  await loadSourceRegistryEnvFileIfPresent(projectRoot, env);

  const baseDatabaseUrl = env.DATABASE_URL ?? env.POSTGRES_URL;
  if (typeof baseDatabaseUrl !== "string" || baseDatabaseUrl.trim().length === 0) {
    throw new Error("Missing DATABASE_URL or POSTGRES_URL for source registry tests");
  }

  testDatabaseUrl = baseDatabaseUrl.trim();
  registryBackupSchemaName = `registry_backup_${Date.now()}_${process.pid}`;

  const registrySchemaExists = readScalarQuery(
    testDatabaseUrl,
    "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'registry');"
  );
  if (registrySchemaExists === "t") {
    expectCommandSuccess(
      "psql",
      [
        testDatabaseUrl,
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `ALTER SCHEMA registry RENAME TO ${registryBackupSchemaName};`,
      ],
      {}
    );
  }

  expectCommandSuccess(
    "psql",
    [
      testDatabaseUrl,
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "DROP SCHEMA IF EXISTS registry CASCADE;",
    ],
    {}
  );
});

afterAll(() => {
  if (testDatabaseUrl.length === 0) {
    return;
  }

  expectCommandSuccess(
    "psql",
    [
      testDatabaseUrl,
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "DROP SCHEMA IF EXISTS registry CASCADE;",
    ],
    {}
  );

  if (registryBackupSchemaName.length === 0) {
    return;
  }

  const backupSchemaExists = readScalarQuery(
    testDatabaseUrl,
    `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = '${registryBackupSchemaName}');`
  );
  if (backupSchemaExists !== "t") {
    return;
  }

  expectCommandSuccess(
    "psql",
    [
      testDatabaseUrl,
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `ALTER SCHEMA ${registryBackupSchemaName} RENAME TO registry;`,
    ],
    {}
  );
});

describe("source-registry-publish", () => {
  it("reads the frozen MVP seed bundle with the expected row counts", async () => {
    const bundle = await readSourceRegistrySeedBundle(projectRoot);

    expect(bundle.logicalRegistryVersion).toBe("registry-v1");
    expect(bundle.definitions).toHaveLength(38);
    expect(bundle.versions).toHaveLength(38);
    expect(bundle.dependencyRules).toHaveLength(25);
  });

  it("generates sortable registry versions and conservative access defaults", () => {
    expect(generateSourceRegistryVersion(new Date("2026-03-26T15:04:05Z"))).toBe(
      "registry-v1-20260326T150405Z"
    );
    expect(resolveSourceRegistryAccessStatus("live_public_us")).toBe("accessible");
    expect(resolveSourceRegistryAccessStatus("downloaded_licensed")).toBe("accessible");
    expect(resolveSourceRegistryAccessStatus("approved_not_integrated")).toBe("planned");
    expect(resolveSourceRegistryAccessStatus("planned_restricted")).toBe("planned");
  });

  it("applies the registry schema idempotently", () => {
    const env = {
      DATABASE_URL: testDatabaseUrl,
      POSTGRES_URL: testDatabaseUrl,
    };

    expectCommandSuccess("bash", ["./scripts/init-source-registry-schema.sh"], env);
    expectCommandSuccess("bash", ["./scripts/init-source-registry-schema.sh"], env);

    expect(
      readIntegerQuery(
        testDatabaseUrl,
        "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'registry' AND table_type = 'BASE TABLE';"
      )
    ).toBe(4);
    expect(
      readIntegerQuery(
        testDatabaseUrl,
        "SELECT count(*) FROM information_schema.views WHERE table_schema = 'registry';"
      )
    ).toBe(3);
  });

  it("publishes immutable registry versions, seeds runtime status, and advances the runtime views", () => {
    const env = {
      DATABASE_URL: testDatabaseUrl,
      POSTGRES_URL: testDatabaseUrl,
    };

    const firstVersion = "registry-v1-test-a";
    const secondVersion = "registry-v1-test-b";

    expectCommandSuccess(
      "bun",
      [
        "run",
        "./scripts/publish-source-registry.ts",
        `--registry-version=${firstVersion}`,
        "--published-at=2026-03-26T15:00:00Z",
      ],
      env
    );

    expect(
      readIntegerQuery(testDatabaseUrl, "SELECT count(*) FROM registry.source_definition;")
    ).toBe(38);
    expect(readIntegerQuery(testDatabaseUrl, "SELECT count(*) FROM registry.source_version;")).toBe(
      38
    );
    expect(
      readIntegerQuery(testDatabaseUrl, "SELECT count(*) FROM registry.source_dependency_rule;")
    ).toBe(25);
    expect(
      readIntegerQuery(testDatabaseUrl, "SELECT count(*) FROM registry.source_runtime_status;")
    ).toBe(38);
    expect(readIntegerQuery(testDatabaseUrl, "SELECT count(*) FROM registry.active_sources;")).toBe(
      38
    );
    expect(
      readIntegerQuery(testDatabaseUrl, "SELECT count(*) FROM registry.current_source_status;")
    ).toBe(38);
    expect(
      readIntegerQuery(testDatabaseUrl, "SELECT count(*) FROM registry.downstream_rules;")
    ).toBe(25);
    expect(
      readScalarQuery(
        testDatabaseUrl,
        "SELECT access_status FROM registry.current_source_status WHERE source_id = 'fiberlocator';"
      )
    ).toBe("accessible");
    expect(
      readScalarQuery(
        testDatabaseUrl,
        "SELECT access_status FROM registry.current_source_status WHERE source_id = 'eq-research';"
      )
    ).toBe("planned");
    expect(
      readScalarQuery(
        testDatabaseUrl,
        "SELECT staleness_state FROM registry.current_source_status WHERE source_id = 'eia-861';"
      )
    ).toBe("aging");
    expect(
      readScalarQuery(
        testDatabaseUrl,
        "SELECT ingestion_health FROM registry.current_source_status WHERE source_id = 'eia-861';"
      )
    ).toBe("healthy");

    const failedPublish = runCommand(
      "bun",
      [
        "run",
        "./scripts/publish-source-registry.ts",
        `--registry-version=${firstVersion}`,
        "--published-at=2026-03-26T15:01:00Z",
      ],
      env
    );

    expect(failedPublish.exitCode).not.toBe(0);
    expect(
      readIntegerQuery(testDatabaseUrl, "SELECT count(*) FROM registry.source_definition;")
    ).toBe(38);
    expect(readIntegerQuery(testDatabaseUrl, "SELECT count(*) FROM registry.source_version;")).toBe(
      38
    );
    expect(
      readIntegerQuery(testDatabaseUrl, "SELECT count(*) FROM registry.source_dependency_rule;")
    ).toBe(25);

    expectCommandSuccess(
      "bun",
      [
        "run",
        "./scripts/publish-source-registry.ts",
        `--registry-version=${secondVersion}`,
        "--published-at=2026-03-26T15:02:00Z",
      ],
      env
    );

    expect(
      readIntegerQuery(testDatabaseUrl, "SELECT count(*) FROM registry.source_definition;")
    ).toBe(76);
    expect(readIntegerQuery(testDatabaseUrl, "SELECT count(*) FROM registry.source_version;")).toBe(
      76
    );
    expect(
      readIntegerQuery(testDatabaseUrl, "SELECT count(*) FROM registry.source_dependency_rule;")
    ).toBe(50);
    expect(
      readIntegerQuery(
        testDatabaseUrl,
        "SELECT count(*) FROM registry.downstream_rules WHERE downstream_object_id = 'policy_posture_state';"
      )
    ).toBe(1);
    expect(
      readIntegerQuery(testDatabaseUrl, "SELECT count(*) FROM registry.source_runtime_status;")
    ).toBe(38);
    expect(
      readScalarQuery(
        testDatabaseUrl,
        "SELECT DISTINCT registry_version FROM registry.active_sources ORDER BY registry_version;"
      )
    ).toBe(secondVersion);
    expect(
      readScalarQuery(
        testDatabaseUrl,
        "SELECT DISTINCT registry_version FROM registry.current_source_status ORDER BY registry_version;"
      )
    ).toBe(secondVersion);
    expect(
      readIntegerQuery(
        testDatabaseUrl,
        `SELECT count(*) FROM registry.source_definition WHERE registry_version = '${firstVersion}';`
      )
    ).toBe(38);
    expect(
      readIntegerQuery(
        testDatabaseUrl,
        `SELECT count(*) FROM registry.source_definition WHERE registry_version = '${secondVersion}';`
      )
    ).toBe(38);
  });
});

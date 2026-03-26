import { describe, expect, it } from "bun:test";
import { buildDuckDbCliInvocation, resolveDuckDbCliCommand } from "../../src/etl/duckdb-runner";

describe("resolveDuckDbCliCommand", () => {
  it("prefers explicit duckdb env overrides in priority order", () => {
    expect(
      resolveDuckDbCliCommand({
        DUCKDB_BIN: "duckdb-from-bin",
        DUCKDB_CLI: "duckdb-from-cli",
        DUCKDB_EXECUTABLE: "duckdb-from-executable",
      })
    ).toBe("duckdb-from-cli");
    expect(
      resolveDuckDbCliCommand({
        DUCKDB_BIN: "duckdb-from-bin",
        DUCKDB_EXECUTABLE: "duckdb-from-executable",
      })
    ).toBe("duckdb-from-executable");
    expect(
      resolveDuckDbCliCommand({
        DUCKDB_BIN: "duckdb-from-bin",
      })
    ).toBe("duckdb-from-bin");
  });

  it("falls back to the default duckdb executable name", () => {
    expect(resolveDuckDbCliCommand({})).toBe("duckdb");
  });
});

describe("buildDuckDbCliInvocation", () => {
  it("builds the standard run-local duckdb invocation", () => {
    const invocation = buildDuckDbCliInvocation({
      bootstrapPath: "/tmp/run/bootstrap.sql",
      databasePath: "/tmp/run/duckdb/run.duckdb",
      env: {
        DUCKDB_CLI: "/opt/homebrew/bin/duckdb",
      },
      outputMode: "json",
      readOnly: true,
      sql: "select 1 as ok;",
    });

    expect(invocation.command).toBe("/opt/homebrew/bin/duckdb");
    expect(invocation.args).toEqual([
      "-batch",
      "-bail",
      "-init",
      "/tmp/run/bootstrap.sql",
      "-readonly",
      "-json",
      "/tmp/run/duckdb/run.duckdb",
      "-c",
      "select 1 as ok;",
    ]);
  });

  it("omits optional flags when text output and writable mode are requested", () => {
    const invocation = buildDuckDbCliInvocation({
      bootstrapPath: "/tmp/run/bootstrap.sql",
      databasePath: "/tmp/run/duckdb/run.duckdb",
      sql: "select 42;",
    });

    expect(invocation.command).toBe("duckdb");
    expect(invocation.args).toEqual([
      "-batch",
      "-bail",
      "-init",
      "/tmp/run/bootstrap.sql",
      "/tmp/run/duckdb/run.duckdb",
      "-c",
      "select 42;",
    ]);
  });
});

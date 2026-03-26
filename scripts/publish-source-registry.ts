import { findCliArgValue, trimToNull } from "../packages/ops/src/etl/cli-config";
import { resolveProjectRootFromFileUrl } from "../packages/ops/src/etl/project-paths";
import {
  closeSourceRegistrySqlClient,
  publishSourceRegistry,
} from "../packages/ops/src/etl/source-registry-publish";

declare const Bun: {
  argv: readonly string[];
};

const projectRoot = resolveProjectRootFromFileUrl(import.meta.url, 1);

function parsePublishedAt(value: string | null): Date | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid --published-at value: ${value}`);
  }

  return parsed;
}

async function main(): Promise<void> {
  const registryVersion = trimToNull(findCliArgValue(Bun.argv, "registry-version"));
  const publishedAt = parsePublishedAt(trimToNull(findCliArgValue(Bun.argv, "published-at")));
  const summary = await publishSourceRegistry({
    projectRoot,
    publishedAt,
    registryVersion,
  });

  console.log(
    [
      `[source-registry] published ${summary.registryVersion}`,
      `logical_seed=${summary.logicalRegistryVersion}`,
      `definitions=${String(summary.definitionCount)}`,
      `versions=${String(summary.versionCount)}`,
      `dependency_rules=${String(summary.dependencyRuleCount)}`,
      `runtime_status=${String(summary.runtimeStatusCount)}`,
      `published_at=${summary.publishedAt}`,
    ].join(" ")
  );
}

main()
  .catch((error: unknown) => {
    if (error instanceof Error) {
      console.error(`[source-registry] ERROR: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    console.error("[source-registry] ERROR: unknown failure");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSourceRegistrySqlClient();
  });

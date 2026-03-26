import { join, resolve } from "node:path";
import { ensureDirectory, writeJsonAtomic } from "./atomic-file-store";
import { runBufferedCommand } from "./command-runner";
import type {
  PipelineRunnerCommandDefinition,
  PipelineRunnerDataset,
  PipelineRunnerDatasetDefinition,
  PipelineRunnerReason,
  PipelineRunnerStatusFile,
  RunPipelineOptions,
  RunPipelineResult,
} from "./pipeline-runner.types";
import { defaultSnapshotRootForDataset, resolveProjectRootFromFileUrl } from "./project-paths";

const ACTIVE_RUN_FILE_NAME = "active-run.json";
const LATEST_POINTER_FILE_NAME = "latest.json";
const LOG_TAIL_LIMIT = 120;
const PIPELINE_RUNNER_INTERVAL_MS = 3000;
const RUN_ID_MILLISECONDS_RE = /\.\d{3}Z$/;
export const PIPELINE_RUNNER_STATUS_FILE_NAME = "pipeline-runner-status.json";

interface PipelineRunnerTemplateValues {
  readonly run_id: string;
}

interface MutablePipelineRunnerStateProgress {
  expectedCount: number | null;
  isCompleted: boolean;
  lastSourceId: number | null;
  pagesFetched: number;
  state: string;
  updatedAt: string | null;
  writtenCount: number;
}

interface MutablePipelineRunnerRun {
  durationMs: number | null;
  endedAt: string | null;
  exitCode: number | null;
  expectedCount: number | null;
  isRunning: boolean;
  logTail: string[];
  phase: PipelineRunnerStatusFile["run"]["phase"];
  progress: PipelineRunnerStatusFile["run"]["progress"];
  reason: PipelineRunnerStatusFile["run"]["reason"];
  runId: string | null;
  startedAt: string | null;
  states: MutablePipelineRunnerStateProgress[];
  statesCompleted: number;
  statesTotal: number;
  summary: string | null;
  writtenCount: number;
}

interface MutablePipelineRunnerStatusFile {
  enabled: boolean;
  generatedAt: string;
  intervalMs: number;
  latestRunCompletedAt: string | null;
  latestRunId: string | null;
  mode: "external";
  requireStartupSuccess: boolean;
  run: MutablePipelineRunnerRun;
  snapshotRoot: string;
  status: "ok";
}

function copyProcessEnvironment(envSource: NodeJS.ProcessEnv): Record<string, string> {
  return Object.entries(envSource).reduce<Record<string, string>>((next, [key, value]) => {
    if (typeof value === "string") {
      next[key] = value;
    }

    return next;
  }, {});
}

function nowIso(): string {
  return new Date().toISOString();
}

function resolveDefaultRunId(dataset: PipelineRunnerDataset): string {
  const normalizedTimestamp = nowIso().replaceAll(":", "-").replace(RUN_ID_MILLISECONDS_RE, "Z");
  return `${dataset}-${normalizedTimestamp}`;
}

function resolveReason(value: string | undefined): PipelineRunnerReason {
  if (value === "interval" || value === "manual" || value === "startup" || value === "unknown") {
    return value;
  }

  return "manual";
}

function normalizeLogLine(line: string): string {
  return line.trim();
}

function appendLogLine(status: MutablePipelineRunnerStatusFile, line: string): void {
  const normalizedLine = normalizeLogLine(line);
  if (normalizedLine.length === 0) {
    return;
  }

  status.run.logTail.push(normalizedLine);
  if (status.run.logTail.length > LOG_TAIL_LIMIT) {
    status.run.logTail.splice(0, status.run.logTail.length - LOG_TAIL_LIMIT);
  }
}

function substituteTemplate(value: string, templateValues: PipelineRunnerTemplateValues): string {
  return value.replaceAll("{run_id}", templateValues.run_id);
}

function resolveCommandDefinition(
  definition: PipelineRunnerCommandDefinition,
  templateValues: PipelineRunnerTemplateValues
): PipelineRunnerCommandDefinition {
  const resolvedEnv =
    definition.env === undefined
      ? undefined
      : Object.entries(definition.env).reduce<Record<string, string>>((nextEnv, [key, value]) => {
          nextEnv[key] = substituteTemplate(value, templateValues);
          return nextEnv;
        }, {});

  return {
    ...definition,
    command: substituteTemplate(definition.command, templateValues),
    args: definition.args.map((arg) => substituteTemplate(arg, templateValues)),
    ...(resolvedEnv === undefined ? {} : { env: resolvedEnv }),
  };
}

function updateRunTotals(status: MutablePipelineRunnerStatusFile): void {
  const completedStates = status.run.states.filter(
    (state: MutablePipelineRunnerStateProgress) => state.isCompleted
  ).length;
  status.run.statesCompleted = completedStates;
  status.run.statesTotal = status.run.states.length;
  status.run.writtenCount = completedStates;
  status.run.expectedCount = status.run.states.length;
}

function writeRunnerFiles(status: MutablePipelineRunnerStatusFile): void {
  const generatedAt = nowIso();
  const nextStatus: PipelineRunnerStatusFile = {
    ...status,
    generatedAt,
    run: {
      ...status.run,
      logTail: [...status.run.logTail],
      states: status.run.states.map((state: MutablePipelineRunnerStateProgress) => ({ ...state })),
    },
  };

  writeJsonAtomic(join(status.snapshotRoot, PIPELINE_RUNNER_STATUS_FILE_NAME), nextStatus);
  writeJsonAtomic(join(status.snapshotRoot, ACTIVE_RUN_FILE_NAME), {
    runId: status.run.runId,
    reason: status.run.reason,
    phase: status.run.phase,
    isRunning: status.run.isRunning,
    updatedAt: generatedAt,
    summary: status.run.summary,
    progress: status.run.progress,
  });
}

function writeLatestPointer(snapshotRoot: string, runId: string, updatedAt: string): void {
  writeJsonAtomic(join(snapshotRoot, LATEST_POINTER_FILE_NAME), {
    runId,
    updatedAt,
  });
}

function buildDatasetDefinitions(
  projectRoot: string,
  env: NodeJS.ProcessEnv
): Record<PipelineRunnerDataset, PipelineRunnerDatasetDefinition> {
  const publishRoot = join(projectRoot, "apps", "web", "public");
  const cacheRoot = join(projectRoot, ".cache");
  const parcelsSnapshotRoot = resolve(projectRoot, defaultSnapshotRootForDataset("parcels", env));
  const floodSnapshotRoot = resolve(
    projectRoot,
    defaultSnapshotRootForDataset("environmental-flood", env)
  );
  const hydroSnapshotRoot = resolve(
    projectRoot,
    defaultSnapshotRootForDataset("environmental-hydro-basins", env)
  );

  return {
    parcels: {
      dataset: "parcels",
      snapshotDataset: "parcels",
      steps: [
        {
          assetKey: "raw_parcel_extract",
          phase: "extracting",
          commands: [
            {
              command: "bun",
              args: [
                "run",
                join(projectRoot, "scripts", "refresh-parcels.ts"),
                `--output-dir=${parcelsSnapshotRoot}`,
                "--run-id={run_id}",
              ],
            },
          ],
        },
        {
          assetKey: "canonical_parcels",
          deps: ["raw_parcel_extract"],
          phase: "loading",
          commands: [
            {
              command: "bash",
              args: [
                join(projectRoot, "scripts", "load-parcels-canonical.sh"),
                join(parcelsSnapshotRoot, "{run_id}"),
                "{run_id}",
              ],
            },
          ],
        },
        {
          assetKey: "parcel_tilesource",
          deps: ["canonical_parcels"],
          phase: "building",
          commands: [
            {
              command: "bash",
              args: [join(projectRoot, "scripts", "refresh-parcel-tilesource.sh"), "{run_id}"],
            },
          ],
        },
        {
          assetKey: "parcel_pmtiles",
          deps: ["parcel_tilesource"],
          phase: "building",
          commands: [
            {
              command: "bash",
              args: [join(projectRoot, "scripts", "build-parcels-draw-pmtiles.sh"), "{run_id}"],
            },
          ],
        },
        {
          assetKey: "parcel_manifest_publish",
          deps: ["parcel_pmtiles"],
          phase: "publishing",
          commands: [
            {
              command: "bun",
              args: [
                "run",
                join(projectRoot, "scripts", "publish-parcels-manifest.ts"),
                "--dataset=parcels-draw-v1",
                `--output-root=${publishRoot}`,
                "--ingestion-run-id={run_id}",
                "--run-id={run_id}",
              ],
            },
          ],
        },
        {
          assetKey: "validate",
          deps: ["parcel_manifest_publish"],
          phase: "publishing",
          commands: [
            {
              command: "bun",
              args: [
                "run",
                join(projectRoot, "scripts", "validate-published-tiles.ts"),
                "--dataset=parcels-draw-v1",
                `--output-root=${publishRoot}`,
              ],
            },
          ],
        },
      ],
    },
    flood: {
      dataset: "flood",
      snapshotDataset: "environmental-flood",
      steps: [
        {
          assetKey: "raw_fema_extract",
          phase: "extracting",
          commands: [
            {
              command: "bun",
              args: [
                "run",
                join(projectRoot, "scripts", "refresh-environmental-flood.ts"),
                "--run-id={run_id}",
                "--step=extract",
              ],
            },
          ],
        },
        {
          assetKey: "canonical_flood_hazard",
          deps: ["raw_fema_extract"],
          phase: "loading",
          commands: [
            {
              command: "bun",
              args: [
                "run",
                join(projectRoot, "scripts", "refresh-environmental-flood.ts"),
                "--run-id={run_id}",
                "--step=normalize",
              ],
            },
            {
              command: "bun",
              args: [
                "run",
                join(projectRoot, "scripts", "refresh-environmental-flood.ts"),
                "--run-id={run_id}",
                "--step=load",
              ],
            },
          ],
        },
        {
          assetKey: "flood_canonical_geoparquet",
          deps: ["canonical_flood_hazard"],
          phase: "loading",
          commands: [
            {
              command: "bun",
              args: [
                "run",
                join(projectRoot, "scripts", "refresh-environmental-flood.ts"),
                "--run-id={run_id}",
                "--step=export-geoparquet",
              ],
            },
          ],
        },
        {
          assetKey: "flood100_tilesource",
          deps: ["flood_canonical_geoparquet"],
          phase: "building",
          commands: [
            {
              command: "bash",
              args: [
                join(projectRoot, "scripts", "refresh-environmental-flood-tilesources.sh"),
                "{run_id}",
                "100",
              ],
            },
          ],
        },
        {
          assetKey: "flood500_tilesource",
          deps: ["flood_canonical_geoparquet"],
          phase: "building",
          commands: [
            {
              command: "bash",
              args: [
                join(projectRoot, "scripts", "refresh-environmental-flood-tilesources.sh"),
                "{run_id}",
                "500",
              ],
            },
          ],
        },
        {
          assetKey: "flood_pmtiles",
          deps: ["flood100_tilesource", "flood500_tilesource"],
          phase: "building",
          commands: [
            {
              command: "bash",
              args: [
                join(projectRoot, "scripts", "build-environmental-flood-pmtiles.sh"),
                "{run_id}",
              ],
            },
          ],
        },
        {
          assetKey: "flood_manifest_publish",
          deps: ["flood_pmtiles"],
          phase: "publishing",
          commands: [
            {
              command: "bun",
              args: [
                "run",
                join(projectRoot, "scripts", "publish-parcels-manifest.ts"),
                "--dataset=environmental-flood",
                `--output-root=${publishRoot}`,
                `--snapshot-root=${floodSnapshotRoot}`,
                `--tiles-out-dir=${join(cacheRoot, "tiles", "environmental-flood")}`,
                "--ingestion-run-id={run_id}",
                "--run-id={run_id}",
              ],
            },
          ],
        },
        {
          assetKey: "validate",
          deps: ["flood_manifest_publish"],
          phase: "publishing",
          commands: [
            {
              command: "bun",
              args: [
                "run",
                join(projectRoot, "scripts", "validate-published-tiles.ts"),
                "--dataset=environmental-flood",
                `--output-root=${publishRoot}`,
              ],
            },
          ],
        },
      ],
    },
    "hydro-basins": {
      dataset: "hydro-basins",
      snapshotDataset: "environmental-hydro-basins",
      steps: [
        {
          assetKey: "raw_hydro_source",
          phase: "extracting",
          commands: [
            {
              command: "bun",
              args: [
                "run",
                join(projectRoot, "scripts", "refresh-environmental-hydro-basins.ts"),
                "--run-id={run_id}",
                "--step=extract",
              ],
            },
          ],
        },
        {
          assetKey: "canonical_huc_polygons",
          deps: ["raw_hydro_source"],
          phase: "loading",
          commands: [
            {
              command: "bun",
              args: [
                "run",
                join(projectRoot, "scripts", "refresh-environmental-hydro-basins.ts"),
                "--run-id={run_id}",
                "--step=normalize",
              ],
            },
            {
              command: "bash",
              args: [
                join(projectRoot, "scripts", "load-environmental-hydro-canonical.sh"),
                "{run_id}",
              ],
            },
          ],
        },
        {
          assetKey: "hydro_tilesource",
          deps: ["canonical_huc_polygons"],
          phase: "building",
          commands: [
            {
              command: "bash",
              args: [
                join(projectRoot, "scripts", "refresh-environmental-hydro-tilesource.sh"),
                "{run_id}",
              ],
            },
          ],
        },
        {
          assetKey: "hydro_pmtiles",
          deps: ["hydro_tilesource"],
          phase: "building",
          commands: [
            {
              command: "bash",
              args: [
                join(projectRoot, "scripts", "build-environmental-hydro-basins-pmtiles.sh"),
                "{run_id}",
              ],
            },
          ],
        },
        {
          assetKey: "hydro_manifest_publish",
          deps: ["hydro_pmtiles"],
          phase: "publishing",
          commands: [
            {
              command: "bun",
              args: [
                "run",
                join(projectRoot, "scripts", "publish-parcels-manifest.ts"),
                "--dataset=environmental-hydro-basins",
                `--output-root=${publishRoot}`,
                `--snapshot-root=${hydroSnapshotRoot}`,
                `--tiles-out-dir=${join(cacheRoot, "tiles", "environmental-hydro-basins")}`,
                "--ingestion-run-id={run_id}",
                "--run-id={run_id}",
              ],
            },
          ],
        },
        {
          assetKey: "validate",
          deps: ["hydro_manifest_publish"],
          phase: "publishing",
          commands: [
            {
              command: "bun",
              args: [
                "run",
                join(projectRoot, "scripts", "validate-published-tiles.ts"),
                "--dataset=environmental-hydro-basins",
                `--output-root=${publishRoot}`,
              ],
            },
          ],
        },
      ],
    },
  };
}

function createInitialStatus(args: {
  readonly definition: PipelineRunnerDatasetDefinition;
  readonly runId: string;
  readonly reason: PipelineRunnerReason;
  readonly snapshotRoot: string;
  readonly startedAt: string;
}): MutablePipelineRunnerStatusFile {
  const states = args.definition.steps.map<MutablePipelineRunnerStateProgress>((step) => ({
    state: step.assetKey,
    expectedCount: 1,
    writtenCount: 0,
    pagesFetched: 0,
    lastSourceId: null,
    updatedAt: null,
    isCompleted: false,
  }));

  return {
    status: "ok",
    generatedAt: args.startedAt,
    enabled: true,
    mode: "external",
    intervalMs: PIPELINE_RUNNER_INTERVAL_MS,
    requireStartupSuccess: false,
    snapshotRoot: args.snapshotRoot,
    latestRunId: args.runId,
    latestRunCompletedAt: null,
    run: {
      runId: args.runId,
      reason: args.reason,
      phase: "idle",
      isRunning: true,
      startedAt: args.startedAt,
      endedAt: null,
      durationMs: null,
      exitCode: null,
      summary: "queued",
      progress: {
        schemaVersion: 1,
        phase: "idle",
      },
      states,
      statesCompleted: 0,
      statesTotal: states.length,
      writtenCount: 0,
      expectedCount: states.length,
      logTail: [],
    },
  };
}

async function runStepCommand(args: {
  readonly command: PipelineRunnerCommandDefinition;
  readonly env: NodeJS.ProcessEnv;
  readonly projectRoot: string;
  readonly status: MutablePipelineRunnerStatusFile;
  readonly stepKey: string;
}): Promise<number> {
  const retries = Math.max(0, args.command.retries ?? 0);
  const commandEnv = {
    ...copyProcessEnvironment(args.env),
    ...(args.command.env ?? {}),
  };

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    appendLogLine(
      args.status,
      `[${args.stepKey}] starting attempt ${String(attempt + 1)}: ${args.command.command}`
    );
    writeRunnerFiles(args.status);

    const result = await runBufferedCommand({
      command: args.command.command,
      args: args.command.args,
      cwd: args.projectRoot,
      env: commandEnv,
      stdout: {
        onLine: (line) => {
          appendLogLine(args.status, `[${args.stepKey}] ${line}`);
        },
      },
      stderr: {
        onLine: (line) => {
          appendLogLine(args.status, `[${args.stepKey}] ${line}`);
        },
      },
    });

    appendLogLine(
      args.status,
      `[${args.stepKey}] attempt ${String(attempt + 1)} exited ${String(result.exitCode)}`
    );

    if (result.exitCode === 0) {
      return 0;
    }

    if (attempt < retries) {
      appendLogLine(args.status, `[${args.stepKey}] retrying`);
      writeRunnerFiles(args.status);
      continue;
    }

    return result.exitCode;
  }

  return 1;
}

export async function runPipeline(options: RunPipelineOptions): Promise<RunPipelineResult> {
  const env = options.env ?? process.env;
  const projectRoot = options.projectRoot ?? resolveProjectRootFromFileUrl(import.meta.url, 4);
  const definitions = buildDatasetDefinitions(projectRoot, env);
  const definition = definitions[options.dataset];
  const snapshotRoot = resolve(
    projectRoot,
    defaultSnapshotRootForDataset(definition.snapshotDataset, env)
  );
  const runId = options.runId ?? env.RUN_ID ?? resolveDefaultRunId(options.dataset);
  const reason = resolveReason(options.reason ?? env.PIPELINE_RUN_REASON);
  const templateValues: PipelineRunnerTemplateValues = {
    run_id: runId,
  };
  const startedAt = nowIso();
  const status = createInitialStatus({
    definition,
    runId,
    reason,
    snapshotRoot,
    startedAt,
  });

  ensureDirectory(snapshotRoot);
  ensureDirectory(join(snapshotRoot, runId));
  writeRunnerFiles(status);

  for (const step of definition.steps) {
    status.run.phase = step.phase;
    status.run.summary = `running ${step.assetKey}`;
    status.run.progress = {
      schemaVersion: 1,
      phase: step.phase,
    };
    writeRunnerFiles(status);

    for (const command of step.commands) {
      const resolvedCommand = resolveCommandDefinition(command, templateValues);
      const exitCode = await runStepCommand({
        command: resolvedCommand,
        env,
        projectRoot,
        status,
        stepKey: step.assetKey,
      });

      if (exitCode !== 0) {
        status.run.phase = "failed";
        status.run.isRunning = false;
        status.run.endedAt = nowIso();
        status.run.durationMs = Date.now() - Date.parse(startedAt);
        status.run.exitCode = exitCode;
        status.run.summary = `failed at ${step.assetKey} exit_code=${String(exitCode)}`;
        status.run.progress = {
          schemaVersion: 1,
          phase: "failed",
        };
        writeRunnerFiles(status);
        throw new Error(status.run.summary);
      }
    }

    const state = status.run.states.find(
      (entry: MutablePipelineRunnerStateProgress) => entry.state === step.assetKey
    );
    if (state !== undefined) {
      state.isCompleted = true;
      state.pagesFetched = 1;
      state.updatedAt = nowIso();
      state.writtenCount = 1;
    }
    updateRunTotals(status);
    status.run.summary = `completed ${step.assetKey}`;
    writeRunnerFiles(status);
  }

  const completedAt = nowIso();
  status.latestRunCompletedAt = completedAt;
  status.run.phase = "completed";
  status.run.isRunning = false;
  status.run.endedAt = completedAt;
  status.run.durationMs = Date.now() - Date.parse(startedAt);
  status.run.exitCode = 0;
  status.run.summary = "completed";
  status.run.progress = {
    schemaVersion: 1,
    phase: "completed",
  };
  updateRunTotals(status);
  writeRunnerFiles(status);
  writeLatestPointer(snapshotRoot, runId, completedAt);

  return {
    runId,
    snapshotRoot,
    statusFilePath: join(snapshotRoot, PIPELINE_RUNNER_STATUS_FILE_NAME),
  };
}

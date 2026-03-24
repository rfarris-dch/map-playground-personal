import {
  buildCountyPowerLoadPayload as buildCountyPowerLoadPayloadImplementation,
  closeCountyPowerSql as closeCountyPowerSqlImplementation,
  createCountyPowerRunId as createCountyPowerRunIdImplementation,
  decodeCountyPowerBundleManifest as decodeCountyPowerBundleManifestImplementation,
  decodeCountyPowerRunConfig as decodeCountyPowerRunConfigImplementation,
  ensureCountyPowerRunDirectories as ensureCountyPowerRunDirectoriesImplementation,
  loadCountyPowerPayload as loadCountyPowerPayloadImplementation,
  materializeCountyPowerManifest as materializeCountyPowerManifestImplementation,
  normalizeCountyPowerBundle as normalizeCountyPowerBundleImplementation,
  readNormalizedCountyPowerBundle as readNormalizedCountyPowerBundleImplementation,
  resolveCountyPowerRunContext as resolveCountyPowerRunContextImplementation,
  verifyCountyPowerRunConfig as verifyCountyPowerRunConfigImplementation,
  writeCountyPowerRunConfig as writeCountyPowerRunConfigImplementation,
} from "./county-power-sync.impl.js";
import type {
  CountyPowerBundleManifest,
  CountyPowerLoadOptions,
  CountyPowerLoadPayload,
  CountyPowerMaterializedManifest,
  CountyPowerNormalizedBundle,
  CountyPowerRunConfig,
  CountyPowerRunContext,
} from "./county-power-sync.types";

export function createCountyPowerRunId(date?: Date): string {
  return createCountyPowerRunIdImplementation(date);
}

export function resolveCountyPowerRunContext(
  projectRoot: string,
  runId: string,
  env?: NodeJS.ProcessEnv
): CountyPowerRunContext {
  return resolveCountyPowerRunContextImplementation(projectRoot, runId, env);
}

export function ensureCountyPowerRunDirectories(context: CountyPowerRunContext): void {
  ensureCountyPowerRunDirectoriesImplementation(context);
}

export function writeCountyPowerRunConfig(
  path: string,
  config: Omit<CountyPowerRunConfig, "createdAt">
): void {
  writeCountyPowerRunConfigImplementation(path, config);
}

export function verifyCountyPowerRunConfig(
  path: string,
  expected: Omit<CountyPowerRunConfig, "createdAt">
): void {
  verifyCountyPowerRunConfigImplementation(path, expected);
}

export function decodeCountyPowerRunConfig(value: unknown): CountyPowerRunConfig {
  return decodeCountyPowerRunConfigImplementation(value);
}

export function decodeCountyPowerBundleManifest(value: unknown): CountyPowerBundleManifest {
  const manifest = decodeCountyPowerBundleManifestImplementation(value);

  return {
    bundleVersion: "county-power-v1",
    dataVersion: manifest.dataVersion,
    datasets: {
      congestion: manifest.datasets.congestion,
      countyFipsAliases: manifest.datasets.countyFipsAliases,
      countyOperatorRegions: manifest.datasets.countyOperatorRegions,
      countyOperatorZones: manifest.datasets.countyOperatorZones,
      fiber: manifest.datasets.fiber,
      gas: manifest.datasets.gas,
      gridFriction: manifest.datasets.gridFriction,
      operatorRegions: manifest.datasets.operatorRegions,
      operatorZoneReferences: manifest.datasets.operatorZoneReferences,
      policyEvents: manifest.datasets.policyEvents,
      policySnapshots: manifest.datasets.policySnapshots,
      powerMarketContext: manifest.datasets.powerMarketContext,
      queuePoiReferences: manifest.datasets.queuePoiReferences,
      queueCountyResolutions: manifest.datasets.queueCountyResolutions,
      queueProjects: manifest.datasets.queueProjects,
      queueResolutionOverrides: manifest.datasets.queueResolutionOverrides,
      queueSnapshots: manifest.datasets.queueSnapshots,
      queueUnresolved: manifest.datasets.queueUnresolved,
      transmission: manifest.datasets.transmission,
      utilityContext: manifest.datasets.utilityContext,
    },
    effectiveDate: manifest.effectiveDate,
    generatedAt: manifest.generatedAt,
    month: manifest.month,
  };
}

export async function materializeCountyPowerManifest(args: {
  readonly manifestPath?: string;
  readonly manifestUrl?: string;
  readonly rawDir: string;
  readonly rawManifestPath: string;
}): Promise<CountyPowerMaterializedManifest> {
  const result = await materializeCountyPowerManifestImplementation(args);

  return {
    localManifestPath: result.localManifestPath,
    manifest: decodeCountyPowerBundleManifest(result.manifest),
    manifestPath: result.manifestPath,
    manifestUrl: result.manifestUrl,
  };
}

export function normalizeCountyPowerBundle(args: {
  readonly normalizedDir: string;
  readonly normalizedManifestPath: string;
  readonly rawManifestPath: string;
}): CountyPowerNormalizedBundle {
  const bundle = normalizeCountyPowerBundleImplementation(args);

  return {
    congestion: bundle.congestion,
    countyFipsAliases: bundle.countyFipsAliases,
    countyOperatorRegions: bundle.countyOperatorRegions,
    countyOperatorZones: bundle.countyOperatorZones,
    fiber: bundle.fiber,
    gas: bundle.gas,
    gridFriction: bundle.gridFriction,
    manifest: decodeCountyPowerBundleManifest(bundle.manifest),
    operatorRegions: bundle.operatorRegions,
    operatorZoneReferences: bundle.operatorZoneReferences,
    policyEvents: bundle.policyEvents,
    policySnapshots: bundle.policySnapshots,
    powerMarketContext: bundle.powerMarketContext,
    queuePoiReferences: bundle.queuePoiReferences,
    queueCountyResolutions: bundle.queueCountyResolutions,
    queueProjects: bundle.queueProjects,
    queueResolutionOverrides: bundle.queueResolutionOverrides,
    queueSnapshots: bundle.queueSnapshots,
    queueUnresolved: bundle.queueUnresolved,
    transmission: bundle.transmission,
    utilityContext: bundle.utilityContext,
  };
}

export function readNormalizedCountyPowerBundle(path: string): CountyPowerNormalizedBundle {
  const bundle = readNormalizedCountyPowerBundleImplementation(path);

  return {
    congestion: bundle.congestion,
    countyFipsAliases: bundle.countyFipsAliases,
    countyOperatorRegions: bundle.countyOperatorRegions,
    countyOperatorZones: bundle.countyOperatorZones,
    fiber: bundle.fiber,
    gas: bundle.gas,
    gridFriction: bundle.gridFriction,
    manifest: decodeCountyPowerBundleManifest(bundle.manifest),
    operatorRegions: bundle.operatorRegions,
    operatorZoneReferences: bundle.operatorZoneReferences,
    policyEvents: bundle.policyEvents,
    policySnapshots: bundle.policySnapshots,
    powerMarketContext: bundle.powerMarketContext,
    queuePoiReferences: bundle.queuePoiReferences,
    queueCountyResolutions: bundle.queueCountyResolutions,
    queueProjects: bundle.queueProjects,
    queueResolutionOverrides: bundle.queueResolutionOverrides,
    queueSnapshots: bundle.queueSnapshots,
    queueUnresolved: bundle.queueUnresolved,
    transmission: bundle.transmission,
    utilityContext: bundle.utilityContext,
  };
}

export function buildCountyPowerLoadPayload(
  bundle: CountyPowerNormalizedBundle,
  options: CountyPowerLoadOptions
): CountyPowerLoadPayload {
  return buildCountyPowerLoadPayloadImplementation(bundle, options);
}

export async function loadCountyPowerPayload(payload: CountyPowerLoadPayload): Promise<void> {
  await loadCountyPowerPayloadImplementation(payload);
}

export async function closeCountyPowerSql(): Promise<void> {
  await closeCountyPowerSqlImplementation();
}

import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import {
  buildCountyPowerLoadPayload,
  decodeCountyPowerBundleManifest,
  ensureCountyPowerRunDirectories,
  materializeCountyPowerManifest,
  normalizeCountyPowerBundle,
  readNormalizedCountyPowerBundle,
  resolveCountyPowerRunContext,
  writeCountyPowerSilverParquet,
} from "../../src/etl/county-power-sync";

const tempPaths: string[] = [];

function createTempDir(): string {
  const path = mkdtempSync(join(tmpdir(), "county-power-sync-"));
  tempPaths.push(path);
  return path;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), {
    recursive: true,
  });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeNdjson(path: string, rows: readonly unknown[]): void {
  mkdirSync(dirname(path), {
    recursive: true,
  });
  const content = rows.map((row) => JSON.stringify(row)).join("\n");
  writeFileSync(path, content.length > 0 ? `${content}\n` : "", "utf8");
}

function createManifest() {
  return {
    bundleVersion: "county-power-v1",
    dataVersion: "2026-03-23",
    datasets: {
      countyFipsAliases: {
        path: "county-fips-aliases.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2025-12-31",
        sourceName: "census-county-fips-aliases",
        sourceUri: "https://example.com/census/fips-aliases",
        sourceVersion: "2025-12-31",
      },
      countyOperatorRegions: {
        path: "county-operator-regions.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-07",
        sourceName: "county-operator-regions",
        sourceUri: "https://example.com/operator-regions/counties",
        sourceVersion: "2026-03-07",
      },
      countyOperatorZones: {
        path: "county-operator-zones.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-07",
        sourceName: "county-operator-zones",
        sourceUri: "https://example.com/operator-zones/counties",
        sourceVersion: "2026-03-07",
      },
      fiber: {
        path: "fiber.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-06",
        sourceName: "fiberlocator-county-fiber-presence",
        sourceUri:
          "https://example.com/fiberlocator/layers/toc | https://example.com/fiberlocator/layers/inview/{bbox}/{branches}",
        sourceVersion: 'W/"fiber-etag"',
      },
      gas: {
        path: "gas.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-06",
        sourceName: "npms-active-gas-transmission-county-mileage",
        sourceUri: "https://example.com/npms/gas-county-mileage",
        sourceVersion: "2026-03-06",
      },
      congestion: {
        path: "congestion.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-05",
        sourceName: "pjm-data-miner",
        sourceUri: "https://example.com/pjm/congestion",
        sourceVersion: "2026-03-05",
      },
      gridFriction: {
        path: "grid-friction.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-05",
        sourceName: "queue-and-congestion-derived",
        sourceUri: "https://example.com/grid-friction",
        sourceVersion: "2026-03-05",
      },
      operatorRegions: {
        path: "operator-regions.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-07",
        sourceName: "operator-regions",
        sourceUri: "https://example.com/operator-regions",
        sourceVersion: "2026-03-07",
      },
      operatorZoneReferences: {
        path: "operator-zone-references.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-07",
        sourceName: "operator-zone-references",
        sourceUri: "https://example.com/operator-zones",
        sourceVersion: "2026-03-07",
      },
      policyEvents: {
        path: "policy-events.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-08",
        sourceName: "state-policy-events",
        sourceUri: "https://example.com/policy/events",
        sourceVersion: "2026-03-08",
      },
      policySnapshots: {
        path: "policy-snapshots.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-08",
        sourceName: "state-policy-snapshots",
        sourceUri: "https://example.com/policy/snapshots",
        sourceVersion: "2026-03-08",
      },
      powerMarketContext: {
        path: "power-market-context.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-07",
        sourceName: "ferc-eia-baseline",
        sourceUri: "https://example.com/ferc/rto-counties",
        sourceVersion: "2026-03-07",
      },
      queueCountyResolutions: {
        path: "queue-county-resolutions.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-20",
        sourceName: "queue-county-resolutions",
        sourceUri: "https://example.com/spp/queue-county-resolutions",
        sourceVersion: "2026-03-20",
      },
      queuePoiReferences: {
        path: "queue-poi-references.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-20",
        sourceName: "queue-poi-references",
        sourceUri: "https://example.com/spp/queue-poi-references",
        sourceVersion: "2026-03-20",
      },
      queueProjects: {
        path: "queue-projects.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-20",
        sourceName: "spp-active-queue-projects",
        sourceUri: "https://example.com/spp/queue-projects",
        sourceVersion: "2026-03-20",
      },
      queueResolutionOverrides: {
        path: "queue-resolution-overrides.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-20",
        sourceName: "queue-resolution-overrides",
        sourceUri: "https://example.com/spp/queue-resolution-overrides",
        sourceVersion: "2026-03-20",
      },
      queueSnapshots: {
        path: "queue-snapshots.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-20",
        sourceName: "spp-active-queue-snapshots",
        sourceUri: "https://example.com/spp/queue-snapshots",
        sourceVersion: "2026-03-20",
      },
      queueUnresolved: {
        path: "queue-unresolved.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-20",
        sourceName: "queue-unresolved",
        sourceUri: "https://example.com/spp/queue-unresolved",
        sourceVersion: "2026-03-20",
      },
      transmission: {
        path: "transmission.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-06",
        sourceName: "hifld-transmission",
        sourceUri: "https://example.com/hifld/transmission",
        sourceVersion: "2026-03-06",
      },
      utilityContext: {
        path: "utility-context.ndjson",
        recordCount: 1,
        sourceAsOfDate: "2026-03-07",
        sourceName: "eia-861",
        sourceUri: "https://example.com/eia/utility-context",
        sourceVersion: "2026-03-07",
      },
    },
    effectiveDate: "2026-03-23",
    generatedAt: "2026-03-23T12:00:00Z",
    month: "2026-03-01",
  };
}

function writeCanonicalBundleFiles(rootDir: string): void {
  writeNdjson(join(rootDir, "county-fips-aliases.ndjson"), [
    {
      aliasCountyFips: "51515",
      aliasKind: "retired_fips",
      canonicalCountyFips: "51019",
    },
  ]);
  writeNdjson(join(rootDir, "operator-regions.ndjson"), [
    {
      confidenceClass: "official",
      mappingMethod: "organized_market_assignment",
      marketStructure: "organized_market",
      operatorRegion: "ERCOT",
      owner: "county-power-public-us",
      sourceArtifact: "public-us-county-power-market-context",
      sourceVersion: null,
    },
  ]);
  writeNdjson(join(rootDir, "county-operator-regions.ndjson"), [
    {
      allocationShare: 1,
      confidenceClass: "official",
      countyFips: "48453",
      isBorderCounty: false,
      isPrimaryRegion: true,
      isSeamCounty: false,
      mappingMethod: "organized_market_assignment",
      marketStructure: "organized_market",
      operatorRegion: "ERCOT",
      owner: "county-power-public-us",
      sourceArtifact: "public-us-county-power-market-context",
      sourceVersion: null,
    },
  ]);
  writeNdjson(join(rootDir, "operator-zone-references.ndjson"), [
    {
      confidenceClass: "official",
      operator: "ERCOT",
      owner: "county-power-public-us",
      operatorZoneConfidence: "medium",
      operatorZoneLabel: "LCRA",
      operatorZoneType: "load_zone",
      referenceName: "LCRA",
      resolutionMethod: "public_queue_zone",
      sourceArtifact: "public-us-county-power-market-context",
      sourceVersion: null,
      stateAbbrev: "TX",
    },
  ]);
  writeNdjson(join(rootDir, "county-operator-zones.ndjson"), [
    {
      allocationShare: 1,
      confidenceClass: "official",
      countyFips: "48453",
      isPrimarySubregion: true,
      operator: "ERCOT",
      owner: "county-power-public-us",
      operatorZoneConfidence: "medium",
      operatorZoneLabel: "LCRA",
      operatorZoneType: "load_zone",
      resolutionMethod: "public_queue_zone",
      sourceArtifact: "public-us-county-power-market-context",
      sourceVersion: null,
    },
  ]);
  writeNdjson(join(rootDir, "queue-poi-references.ndjson"), [
    {
      countyFips: "48453",
      operator: "ERCOT",
      operatorZoneLabel: "LCRA",
      operatorZoneType: "load_zone",
      queuePoiLabel: "Austin Energy",
      resolutionMethod: "explicit_county",
      resolverConfidence: "high",
      sourceSystem: "ercot-gis",
      stateAbbrev: "TX",
    },
  ]);
  writeNdjson(join(rootDir, "queue-resolution-overrides.ndjson"), [
    {
      allocationShare: 1,
      countyFips: "48453",
      matcherType: "location_label",
      matcherValue: "Travis County",
      notes: "Manual validation fixture",
      resolverConfidence: "high",
      resolverType: "manual_override",
      sourceSystem: "ercot-gis",
      stateAbbrev: "TX",
    },
  ]);
  writeNdjson(join(rootDir, "queue-unresolved.ndjson"), [
    {
      candidateCountyFips: ["48453", "48491"],
      manualReviewFlag: true,
      marketId: "ercot",
      nativeStatus: "study",
      projectId: "ercot-queue-unresolved-001",
      queueName: "ERCOT GIS",
      queuePoiLabel: "Ambiguous Substation",
      rawLocationLabel: "Travis / Williamson",
      sourceSystem: "ercot-gis",
      stateAbbrev: "TX",
      unresolvedReason: "ambiguous_location",
    },
  ]);
}

afterEach(() => {
  while (tempPaths.length > 0) {
    const path = tempPaths.pop();
    if (typeof path === "string") {
      rmSync(path, {
        force: true,
        recursive: true,
      });
    }
  }
});

describe("county-power-sync", () => {
  it("dual-writes normalized NDJSON tables to silver Parquet and registers the lake artifacts", async () => {
    const projectRoot = createTempDir();
    const context = resolveCountyPowerRunContext(
      projectRoot,
      "county-power-sync-2026-03-25T12-00-00Z"
    );

    ensureCountyPowerRunDirectories(context);
    writeJson(context.rawManifestPath, createManifest());
    writeCanonicalBundleFiles(context.rawDir);
    writeNdjson(join(context.rawDir, "power-market-context.ndjson"), [
      {
        balancingAuthority: "ERCOT",
        countyFips: "48453",
        loadZone: "LCRA",
        marketStructure: "organized_market",
        meteoZone: "Austin/San Antonio (TX215)",
        operatorWeatherZone: "South Central",
        operatorZoneConfidence: "medium",
        operatorZoneLabel: "LCRA",
        operatorZoneType: "load_zone",
        weatherZone: "South Central",
        wholesaleOperator: "ERCOT",
      },
    ]);
    writeNdjson(join(context.rawDir, "utility-context.ndjson"), [
      {
        competitiveAreaType: "choice",
        countyFips: "48453",
        dominantUtilityId: "oncor",
        dominantUtilityName: "Oncor Electric Delivery",
        primaryTduOrUtility: "Oncor",
        retailChoicePenetrationShare: 0.82,
        retailChoiceStatus: "choice",
        territoryType: "tdu",
        utilities: [
          {
            retailChoiceStatus: "choice",
            territoryType: "tdu",
            utilityId: "oncor",
            utilityName: "Oncor Electric Delivery",
          },
        ],
        utilityCount: 1,
      },
    ]);
    writeNdjson(join(context.rawDir, "transmission.ndjson"), [
      {
        countyFips: "48453",
        miles138kvPlus: 96.4,
        miles230kvPlus: 42.8,
        miles345kvPlus: 18.1,
        miles500kvPlus: 0,
        miles69kvPlus: 128.2,
        miles765kvPlus: 0,
      },
    ]);
    writeNdjson(join(context.rawDir, "gas.ndjson"), [
      {
        countyFips: "48453",
        gasPipelineMileageCounty: 42.5,
        gasPipelinePresenceFlag: true,
      },
    ]);
    writeNdjson(join(context.rawDir, "fiber.ndjson"), [
      {
        countyFips: "48453",
        fiberPresenceFlag: true,
      },
    ]);
    writeNdjson(join(context.rawDir, "congestion.ndjson"), [
      {
        avgRtCongestionComponent: 4.8,
        countyFips: "48453",
        negativePriceHourShare: 0.07,
        p95ShadowPrice: 29.4,
        topConstraints: [
          {
            constraintId: "ercot-west-001",
            flowMw: 410,
            hoursBound: 38,
            label: "West export interface",
            limitMw: 450,
            operator: "ERCOT",
            shadowPrice: 29.4,
            voltageKv: 345,
          },
        ],
      },
    ]);
    writeNdjson(join(context.rawDir, "grid-friction.ndjson"), [
      {
        confidence: "high",
        congestionProxyScore: 18.4,
        countyFips: "48453",
        heatmapSignalAvailable: true,
        marketWithdrawalPrior: 0.12,
        medianDaysInQueueActive: 540,
        pastDueShare: 0.18,
        plannedTransmissionUpgradeCount: 2,
        statusMix: {
          active: 1,
        },
      },
    ]);
    writeNdjson(join(context.rawDir, "policy-events.ndjson"), [
      {
        affectedSitingDimension: "generation_siting",
        confidenceClass: "official",
        countyFips: "48453",
        eventDate: "2026-03-08",
        eventId: "tx-policy-001",
        eventType: "community_solar",
        evidenceSummary: "Texas community solar legislation advanced in committee.",
        jurisdictionKey: "48453",
        jurisdictionLevel: "county",
        marketId: "ercot",
        moratoriumStatus: "none",
        policyDirection: "supportive",
        policyStatus: "active",
        policyType: "community_solar",
        sentimentDirection: "positive",
        sourceUrl: "https://example.com/policy/events/tx-policy-001",
        stateAbbrev: "TX",
        title: "Community Solar Committee Vote",
      },
    ]);
    writeNdjson(join(context.rawDir, "policy-snapshots.ndjson"), [
      {
        countyFips: "48453",
        countyTaggedEventShare: 0.5,
        moratoriumStatus: "none",
        policyConstraintScore: 12.4,
        policyEventCount: 2,
        policyMappingConfidence: "high",
        policyMomentumScore: 18.5,
        publicSentimentScore: 0.41,
      },
    ]);
    writeNdjson(join(context.rawDir, "queue-projects.ndjson"), [
      {
        countyFips: "48453",
        fuelType: "battery_storage",
        latestSourceAsOfDate: "2026-03-20",
        marketId: "ercot",
        nativeStatus: "study",
        projectId: "ercot-queue-001",
        queueCountyConfidence: "high",
        queueName: "ERCOT GIS",
        queuePoiLabel: "Austin Energy",
        queueResolverType: "explicit_county",
        sourceSystem: "ercot-gis",
        stageGroup: "active_study",
        stateAbbrev: "TX",
      },
    ]);
    writeNdjson(join(context.rawDir, "queue-county-resolutions.ndjson"), [
      {
        allocationShare: 1,
        countyFips: "48453",
        marketId: "ercot",
        projectId: "ercot-queue-001",
        queuePoiLabel: "Austin Energy",
        resolverConfidence: "high",
        resolverType: "explicit_county",
        sourceLocationLabel: "Travis County",
        sourceSystem: "ercot-gis",
        stateAbbrev: "TX",
      },
    ]);
    writeNdjson(join(context.rawDir, "queue-snapshots.ndjson"), [
      {
        capacityMw: 120,
        completionPrior: 0.3,
        countyFips: "48453",
        daysInQueueActive: 540,
        expectedOperationDate: "2027-06-01",
        isPastDue: false,
        marketId: "ercot",
        nativeStatus: "study",
        projectId: "ercot-queue-001",
        queueDate: "2024-09-05",
        queueStatus: "active",
        signedIa: true,
        sourceSystem: "ercot-gis",
        stageGroup: "active_study",
        stateAbbrev: "TX",
        transmissionUpgradeCostUsd: 1_250_000,
        transmissionUpgradeCount: 2,
        withdrawalPrior: 0.12,
      },
    ]);

    const normalized = normalizeCountyPowerBundle({
      normalizedDir: context.normalizedDir,
      normalizedManifestPath: context.normalizedManifestPath,
      rawManifestPath: context.rawManifestPath,
    });
    const toSnakeCase = (value: string): string =>
      value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
    const normalizedSourcesByLayer = new Map(
      Object.entries(normalized.manifest.datasets).map(([datasetKey, descriptor]) => [
        toSnakeCase(datasetKey),
        join(context.normalizedDir, descriptor.path),
      ])
    );
    const artifacts = await writeCountyPowerSilverParquet({
      bundle: normalized,
      context,
      runner: (options) => {
        const outputPaths = [...options.sql.matchAll(/TO '([^']+)'/g)].map((match) => match[1]);
        for (const rawOutputPath of outputPaths) {
          const outputPath = rawOutputPath?.replaceAll("''", "'") ?? "";
          let parquetOutputPath = outputPath;
          if (!outputPath.endsWith(".parquet")) {
            if (outputPath.includes("table=policy_events")) {
              parquetOutputPath = join(outputPath, "state_abbrev=TX", "part-0.parquet");
            } else if (outputPath.includes("table=queue_")) {
              parquetOutputPath = join(
                outputPath,
                "source_system=ercot-gis",
                "state_abbrev=TX",
                "part-0.parquet"
              );
            } else {
              parquetOutputPath = join(outputPath, "part-0.parquet");
            }
          }

          mkdirSync(dirname(parquetOutputPath), {
            recursive: true,
          });
          writeFileSync(parquetOutputPath, "parquet-fixture");
        }

        return {
          durationMs: 1,
          exitCode: 0,
          stderr: "",
          stdout: "",
        };
      },
    });

    expect(artifacts).toHaveLength(20);
    expect(
      artifacts.some(
        (artifact) =>
          artifact.layer === "queue_projects" &&
          artifact.partitionKeys.includes("source_system") &&
          artifact.partitionKeys.includes("state_abbrev")
      )
    ).toBe(true);
    expect(
      existsSync(join(context.silverPlainDir, "table=power_market_context", "part-0.parquet"))
    ).toBe(true);
    expect(
      existsSync(
        join(
          context.silverPlainDir,
          "table=queue_projects",
          "source_system=ercot-gis",
          "state_abbrev=TX",
          "part-0.parquet"
        )
      )
    ).toBe(true);

    const persistedLakeManifest = JSON.parse(readFileSync(context.lakeManifestPath, "utf8")) as {
      readonly artifacts: readonly Array<{
        readonly layer: string;
        readonly partitionKeys: readonly string[];
        readonly relativePath: string;
      }>;
    };
    const persistedNormalizedManifest = JSON.parse(
      readFileSync(context.normalizedManifestPath, "utf8")
    ) as {
      readonly datasets: {
        readonly powerMarketContext: {
          readonly path: string;
        };
        readonly queueProjects: {
          readonly path: string;
        };
      };
    };

    expect(persistedLakeManifest.artifacts).toHaveLength(20);
    expect(
      persistedLakeManifest.artifacts.some(
        (artifact) =>
          artifact.layer === "power_market_context" &&
          artifact.relativePath === "silver/plain/table=power_market_context"
      )
    ).toBe(true);
    expect(
      persistedLakeManifest.artifacts.some(
        (artifact) =>
          artifact.layer === "queue_projects" &&
          artifact.relativePath === "silver/plain/table=queue_projects"
      )
    ).toBe(true);
    expect(
      persistedLakeManifest.artifacts.every((artifact) => artifact.partitionKeys[0] === "table")
    ).toBe(true);
    expect(persistedNormalizedManifest.datasets.powerMarketContext.path).toBe(
      "../silver/plain/table=power_market_context"
    );
    expect(persistedNormalizedManifest.datasets.queueProjects.path).toBe(
      "../silver/plain/table=queue_projects"
    );

    const rereadBundle = await readNormalizedCountyPowerBundle(
      context.normalizedManifestPath,
      (options) => {
        const outputPaths = [...options.sql.matchAll(/TO '([^']+)'/g)].map((match) => match[1]);
        for (const rawOutputPath of outputPaths) {
          const outputPath = rawOutputPath?.replaceAll("''", "'") ?? "";
          const layer = basename(outputPath, ".ndjson");
          const sourcePath = normalizedSourcesByLayer.get(layer);
          if (typeof sourcePath !== "string") {
            throw new Error(`Missing normalized source fixture for ${layer}`);
          }

          mkdirSync(dirname(outputPath), {
            recursive: true,
          });
          writeFileSync(outputPath, readFileSync(sourcePath, "utf8"));
        }

        return Promise.resolve({
          durationMs: 1,
          exitCode: 0,
          stderr: "",
          stdout: "",
        });
      }
    );
    const rereadPayload = buildCountyPowerLoadPayload(rereadBundle, {
      modelVersion: "county-power-v1",
      sourcePullTimestamp: "2026-03-23T12:00:00Z",
    });

    expect(rereadBundle.manifest.datasets.queueProjects.path).toBe(
      "../silver/plain/table=queue_projects"
    );
    expect(rereadPayload.utilityContext[0]?.utilityCount).toBe(1);
    expect(rereadPayload.powerMarketContext[0]).toMatchObject({
      countyGeoid: "48453",
      wholesaleOperator: "ERCOT",
    });
    expect(rereadPayload.queueProjects[0]).toMatchObject({
      projectId: "ercot-queue-001",
      sourceSystem: "ercot-gis",
      stateAbbrev: "TX",
    });
  });

  it("decodes the canonical bundle manifest", () => {
    const manifest = decodeCountyPowerBundleManifest(createManifest());

    expect(manifest.bundleVersion).toBe("county-power-v1");
    expect(manifest.datasets.utilityContext.sourceName).toBe("eia-861");
    expect(manifest.month).toBe("2026-03-01");
  });

  it("materializes a local manifest and its dataset files", async () => {
    const sourceDir = createTempDir();
    const rawDir = join(createTempDir(), "raw");
    const manifestPath = join(sourceDir, "manifest.json");

    writeJson(manifestPath, createManifest());
    writeCanonicalBundleFiles(sourceDir);
    writeNdjson(join(sourceDir, "power-market-context.ndjson"), [
      {
        balancingAuthority: "ERCOT",
        countyFips: "48453",
        loadZone: "LCRA",
        marketStructure: "organized_market",
        meteoZone: "Austin/San Antonio (TX215)",
        operatorWeatherZone: "South Central",
        operatorZoneConfidence: "medium",
        operatorZoneLabel: "LCRA",
        operatorZoneType: "load_zone",
        weatherZone: "South Central",
        wholesaleOperator: "ERCOT",
      },
    ]);
    writeNdjson(join(sourceDir, "utility-context.ndjson"), [
      {
        competitiveAreaType: "choice",
        countyFips: "48453",
        dominantUtilityId: "oncor",
        dominantUtilityName: "Oncor Electric Delivery",
        primaryTduOrUtility: "Oncor",
        retailChoicePenetrationShare: 0.82,
        retailChoiceStatus: "choice",
        territoryType: "tdu",
        utilities: [
          {
            retailChoiceStatus: "choice",
            territoryType: "tdu",
            utilityId: "oncor",
            utilityName: "Oncor Electric Delivery",
          },
        ],
        utilityCount: 1,
      },
    ]);
    writeNdjson(join(sourceDir, "transmission.ndjson"), [
      {
        countyFips: "48453",
        miles138kvPlus: 96.4,
        miles230kvPlus: 42.8,
        miles345kvPlus: 18.1,
        miles500kvPlus: 0,
        miles69kvPlus: 128.2,
        miles765kvPlus: 0,
      },
    ]);
    writeNdjson(join(sourceDir, "gas.ndjson"), [
      {
        countyFips: "48453",
        gasPipelineMileageCounty: 42.5,
        gasPipelinePresenceFlag: true,
      },
    ]);
    writeNdjson(join(sourceDir, "fiber.ndjson"), [
      {
        countyFips: "48453",
        fiberPresenceFlag: true,
      },
    ]);
    writeNdjson(join(sourceDir, "congestion.ndjson"), [
      {
        avgRtCongestionComponent: 4.8,
        countyFips: "48453",
        negativePriceHourShare: 0.07,
        p95ShadowPrice: 29.4,
        topConstraints: [
          {
            constraintId: "ercot-west-001",
            flowMw: 410,
            hoursBound: 38,
            label: "West export interface",
            limitMw: 450,
            operator: "ERCOT",
            shadowPrice: 29.4,
            voltageKv: 345,
          },
        ],
      },
    ]);
    writeNdjson(join(sourceDir, "grid-friction.ndjson"), [
      {
        confidence: "high",
        congestionProxyScore: 18.4,
        countyFips: "48453",
        heatmapSignalAvailable: true,
        marketWithdrawalPrior: 0.12,
        medianDaysInQueueActive: 540,
        pastDueShare: 0.18,
        plannedTransmissionUpgradeCount: 2,
        statusMix: {
          active: 1,
        },
      },
    ]);
    writeNdjson(join(sourceDir, "policy-events.ndjson"), [
      {
        affectedSitingDimension: "generation_siting",
        countyFips: "48453",
        confidenceClass: "official",
        eventDate: "2026-03-08",
        eventId: "tx-policy-001",
        eventType: "community_solar",
        evidenceSummary: "Texas community solar legislation advanced in committee.",
        jurisdictionKey: "48453",
        jurisdictionLevel: "county",
        marketId: "ercot",
        moratoriumStatus: "none",
        policyDirection: "supportive",
        policyStatus: "active",
        policyType: "community_solar",
        sentimentDirection: "positive",
        sourceUrl: "https://example.com/policy/events/tx-policy-001",
        stateAbbrev: "TX",
        title: "Community Solar Committee Vote",
      },
    ]);
    writeNdjson(join(sourceDir, "policy-snapshots.ndjson"), [
      {
        countyFips: "48453",
        countyTaggedEventShare: 0.5,
        moratoriumStatus: "none",
        policyConstraintScore: 12.4,
        policyEventCount: 2,
        policyMappingConfidence: "high",
        policyMomentumScore: 18.5,
        publicSentimentScore: 0.41,
      },
    ]);
    writeNdjson(join(sourceDir, "queue-projects.ndjson"), [
      {
        countyFips: "48453",
        fuelType: "battery_storage",
        latestSourceAsOfDate: "2026-03-20",
        marketId: "ercot",
        nativeStatus: "study",
        projectId: "ercot-queue-001",
        queueCountyConfidence: "high",
        queuePoiLabel: "Austin Energy",
        queueName: "ERCOT GIS",
        queueResolverType: "explicit_county",
        stageGroup: "active_study",
        sourceSystem: "ercot-gis",
        stateAbbrev: "TX",
      },
    ]);
    writeNdjson(join(sourceDir, "queue-county-resolutions.ndjson"), [
      {
        allocationShare: 1,
        countyFips: "48453",
        marketId: "ercot",
        projectId: "ercot-queue-001",
        queuePoiLabel: "Austin Energy",
        resolverConfidence: "high",
        resolverType: "explicit_county",
        sourceLocationLabel: "Travis County",
        sourceSystem: "ercot-gis",
        stateAbbrev: "TX",
      },
    ]);
    writeNdjson(join(sourceDir, "queue-snapshots.ndjson"), [
      {
        capacityMw: 120,
        completionPrior: 0.3,
        countyFips: "48453",
        daysInQueueActive: 540,
        expectedOperationDate: "2027-06-01",
        isPastDue: false,
        marketId: "ercot",
        nativeStatus: "study",
        projectId: "ercot-queue-001",
        queueDate: "2024-09-05",
        queueStatus: "active",
        signedIa: true,
        sourceSystem: "ercot-gis",
        stageGroup: "active_study",
        stateAbbrev: "TX",
        transmissionUpgradeCostUsd: 1_250_000,
        transmissionUpgradeCount: 2,
        withdrawalPrior: 0.12,
      },
    ]);

    const result = await materializeCountyPowerManifest({
      manifestPath,
      rawDir,
      rawManifestPath: join(rawDir, "bundle-manifest.json"),
    });

    expect(result.manifest.datasets.powerMarketContext.path).toBe("power-market-context.ndjson");
    expect(existsSync(join(rawDir, "utility-context.ndjson"))).toBe(true);
  });

  it("normalizes county records into stable sorted files and load payloads", () => {
    const rootDir = createTempDir();
    const rawDir = join(rootDir, "raw");
    const normalizedDir = join(rootDir, "normalized");
    const manifest = createManifest();

    writeJson(join(rawDir, "bundle-manifest.json"), manifest);
    writeCanonicalBundleFiles(rawDir);
    writeNdjson(join(rawDir, "power-market-context.ndjson"), [
      {
        balancingAuthority: "ERCOT",
        countyFips: "48453",
        loadZone: "LCRA",
        marketStructure: "organized_market",
        meteoZone: "Austin/San Antonio (TX215)",
        operatorWeatherZone: "South Central",
        operatorZoneConfidence: "medium",
        operatorZoneLabel: "LCRA",
        operatorZoneType: "load_zone",
        weatherZone: "South Central",
        wholesaleOperator: "ERCOT",
      },
    ]);
    writeNdjson(join(rawDir, "utility-context.ndjson"), [
      {
        competitiveAreaType: "choice",
        countyFips: "48453",
        dominantUtilityId: "oncor",
        dominantUtilityName: "Oncor Electric Delivery",
        primaryTduOrUtility: "Oncor",
        retailChoicePenetrationShare: 0.82,
        retailChoiceStatus: "choice",
        territoryType: "tdu",
        utilities: [
          {
            retailChoiceStatus: "choice",
            territoryType: "tdu",
            utilityId: "oncor",
            utilityName: "Oncor Electric Delivery",
          },
        ],
        utilityCount: null,
      },
    ]);
    writeNdjson(join(rawDir, "transmission.ndjson"), [
      {
        countyFips: "48453",
        miles138kvPlus: 96.4,
        miles230kvPlus: 42.8,
        miles345kvPlus: 18.1,
        miles500kvPlus: 0,
        miles69kvPlus: 128.2,
        miles765kvPlus: 0,
      },
    ]);
    writeNdjson(join(rawDir, "gas.ndjson"), [
      {
        countyFips: "48453",
        gasPipelineMileageCounty: 42.5,
        gasPipelinePresenceFlag: true,
      },
    ]);
    writeNdjson(join(rawDir, "fiber.ndjson"), [
      {
        countyFips: "48453",
        fiberPresenceFlag: true,
      },
    ]);
    writeNdjson(join(rawDir, "congestion.ndjson"), [
      {
        avgRtCongestionComponent: 4.8,
        countyFips: "48453",
        negativePriceHourShare: 0.07,
        p95ShadowPrice: 29.4,
        topConstraints: [
          {
            constraintId: "ercot-west-001",
            flowMw: 410,
            hoursBound: 38,
            label: "West export interface",
            limitMw: 450,
            operator: "ERCOT",
            shadowPrice: 29.4,
            voltageKv: 345,
          },
        ],
      },
    ]);
    writeNdjson(join(rawDir, "grid-friction.ndjson"), [
      {
        confidence: "high",
        congestionProxyScore: 18.4,
        countyFips: "48453",
        heatmapSignalAvailable: true,
        marketWithdrawalPrior: 0.12,
        medianDaysInQueueActive: 540,
        pastDueShare: 0.18,
        plannedTransmissionUpgradeCount: 2,
        statusMix: {
          active: 1,
        },
      },
    ]);
    writeNdjson(join(rawDir, "policy-events.ndjson"), [
      {
        affectedSitingDimension: "generation_siting",
        countyFips: "48453",
        confidenceClass: "official",
        eventDate: "2026-03-08",
        eventId: "tx-policy-001",
        eventType: "community_solar",
        evidenceSummary: "Texas community solar legislation advanced in committee.",
        jurisdictionKey: "48453",
        jurisdictionLevel: "county",
        marketId: "ercot",
        moratoriumStatus: "none",
        policyDirection: "supportive",
        policyStatus: "active",
        policyType: "community_solar",
        sentimentDirection: "positive",
        sourceUrl: "https://example.com/policy/events/tx-policy-001",
        stateAbbrev: "TX",
        title: "Community Solar Committee Vote",
      },
    ]);
    writeNdjson(join(rawDir, "policy-snapshots.ndjson"), [
      {
        countyFips: "48453",
        countyTaggedEventShare: 0.5,
        moratoriumStatus: "none",
        policyConstraintScore: 12.4,
        policyEventCount: 2,
        policyMappingConfidence: "high",
        policyMomentumScore: 18.5,
        publicSentimentScore: 0.41,
      },
    ]);
    writeNdjson(join(rawDir, "queue-projects.ndjson"), [
      {
        countyFips: "48453",
        fuelType: "battery_storage",
        latestSourceAsOfDate: "2026-03-20",
        marketId: "ercot",
        nativeStatus: "study",
        projectId: "ercot-queue-001",
        queueCountyConfidence: "high",
        queuePoiLabel: "Austin Energy",
        queueName: "ERCOT GIS",
        queueResolverType: "explicit_county",
        stageGroup: "active_study",
        sourceSystem: "ercot-gis",
        stateAbbrev: "TX",
      },
    ]);
    writeNdjson(join(rawDir, "queue-county-resolutions.ndjson"), [
      {
        allocationShare: 1,
        countyFips: "48453",
        marketId: "ercot",
        projectId: "ercot-queue-001",
        queuePoiLabel: "Austin Energy",
        resolverConfidence: "high",
        resolverType: "explicit_county",
        sourceLocationLabel: "Travis County",
        sourceSystem: "ercot-gis",
        stateAbbrev: "TX",
      },
    ]);
    writeNdjson(join(rawDir, "queue-snapshots.ndjson"), [
      {
        capacityMw: 120,
        completionPrior: 0.3,
        countyFips: "48453",
        daysInQueueActive: 540,
        expectedOperationDate: "2027-06-01",
        isPastDue: false,
        marketId: "ercot",
        nativeStatus: "study",
        projectId: "ercot-queue-001",
        queueDate: "2024-09-05",
        queueStatus: "active",
        signedIa: true,
        sourceSystem: "ercot-gis",
        stageGroup: "active_study",
        stateAbbrev: "TX",
        transmissionUpgradeCostUsd: 1_250_000,
        transmissionUpgradeCount: 2,
        withdrawalPrior: 0.12,
      },
    ]);

    const normalized = normalizeCountyPowerBundle({
      normalizedDir,
      normalizedManifestPath: join(normalizedDir, "normalized-manifest.json"),
      rawManifestPath: join(rawDir, "bundle-manifest.json"),
    });
    const payload = buildCountyPowerLoadPayload(normalized, {
      modelVersion: "county-power-v1",
      sourcePullTimestamp: "2026-03-23T12:00:00Z",
    });

    expect(normalized.utilityContext[0]?.utilityCount).toBe(1);
    expect(payload.operatorRegions[0]).toMatchObject({
      operatorRegion: "ERCOT",
      sourceAsOfDate: "2026-03-07",
    });
    expect(payload.countyOperatorRegions[0]).toMatchObject({
      countyGeoid: "48453",
      isPrimaryRegion: true,
      operatorRegion: "ERCOT",
    });
    expect(payload.powerMarketContext[0]).toMatchObject({
      countyGeoid: "48453",
      sourceAsOfDate: "2026-03-07",
      wholesaleOperator: "ERCOT",
    });
    expect(payload.gas[0]).toMatchObject({
      countyGeoid: "48453",
      gasPipelineMileageCounty: 42.5,
      gasPipelinePresenceFlag: true,
      sourceAsOfDate: "2026-03-06",
    });
    expect(payload.fiber[0]).toMatchObject({
      countyGeoid: "48453",
      fiberPresenceFlag: true,
      sourceAsOfDate: "2026-03-06",
    });
    expect(payload.gridFriction[0]).toMatchObject({
      confidence: "high",
      countyGeoid: "48453",
      sourceAsOfDate: "2026-03-05",
    });
    expect(payload.policyEvents[0]).toMatchObject({
      countyGeoid: "48453",
      eventId: "tx-policy-001",
      sourceAsOfDate: "2026-03-08",
    });
    expect(payload.policySnapshots[0]).toMatchObject({
      countyGeoid: "48453",
      policyMomentumScore: 18.5,
      sourceAsOfDate: "2026-03-08",
    });
    expect(payload.queueProjects[0]).toMatchObject({
      countyGeoid: "48453",
      fuelType: "battery_storage",
      nativeStatus: "study",
      projectId: "ercot-queue-001",
      queueCountyConfidence: "high",
      queueResolverType: "explicit_county",
      stageGroup: "active_study",
    });
    expect(payload.queueCountyResolutions[0]).toMatchObject({
      allocationShare: 1,
      countyGeoid: "48453",
      projectId: "ercot-queue-001",
    });
    expect(payload.queueSnapshots[0]).toMatchObject({
      capacityMw: 120,
      countyGeoid: "48453",
      nativeStatus: "study",
      projectId: "ercot-queue-001",
      snapshotRunId: "ercot-gis-2026-03-23",
      stageGroup: "active_study",
    });
    expect(payload.queueUnresolved[0]).toMatchObject({
      manualReviewFlag: true,
      projectId: "ercot-queue-unresolved-001",
      unresolvedReason: "ambiguous_location",
    });
    expect(payload.congestion[0]?.topConstraintsJson).toContain("ercot-west-001");
    expect(payload.utilityContext[0]?.utilitiesJson).toContain("Oncor Electric Delivery");
  });
});

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeCountyPowerBundle } from "../packages/ops/src/etl/county-power-sync.ts";

const root = mkdtempSync(join(tmpdir(), "cp-gas-"));
const raw = join(root, "raw");
const norm = join(root, "normalized");
mkdirSync(raw, { recursive: true });
const manifest = {
  bundleVersion: "county-power-v1",
  dataVersion: "2026-03-23",
  effectiveDate: "2026-03-23",
  generatedAt: "2026-03-23T12:00:00Z",
  month: "2026-03-01",
  datasets: {
    congestion: {
      path: "congestion.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    countyFipsAliases: {
      path: "county-fips-aliases.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    countyOperatorRegions: {
      path: "county-operator-regions.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    countyOperatorZones: {
      path: "county-operator-zones.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    gas: {
      path: "gas.ndjson",
      recordCount: 1,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    gridFriction: {
      path: "grid-friction.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    operatorRegions: {
      path: "operator-regions.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    operatorZoneReferences: {
      path: "operator-zone-references.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    policyEvents: {
      path: "policy-events.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    policySnapshots: {
      path: "policy-snapshots.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    powerMarketContext: {
      path: "power-market-context.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    queueCountyResolutions: {
      path: "queue-county-resolutions.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    queuePoiReferences: {
      path: "queue-poi-references.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    queueProjects: {
      path: "queue-projects.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    queueResolutionOverrides: {
      path: "queue-resolution-overrides.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    queueSnapshots: {
      path: "queue-snapshots.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    queueUnresolved: {
      path: "queue-unresolved.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    transmission: {
      path: "transmission.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
    utilityContext: {
      path: "utility-context.ndjson",
      recordCount: 0,
      sourceAsOfDate: "2026-03-01",
      sourceName: "x",
      sourceUri: "x",
      sourceVersion: "x",
    },
  },
};
writeFileSync(join(raw, "bundle-manifest.json"), JSON.stringify(manifest));
for (const name of [
  "county-fips-aliases",
  "county-operator-regions",
  "county-operator-zones",
  "operator-regions",
  "operator-zone-references",
  "power-market-context",
  "utility-context",
  "transmission",
  "congestion",
  "grid-friction",
  "policy-events",
  "policy-snapshots",
  "queue-poi-references",
  "queue-county-resolutions",
  "queue-projects",
  "queue-resolution-overrides",
  "queue-snapshots",
  "queue-unresolved",
]) {
  writeFileSync(join(raw, `${name}.ndjson`), "");
}
writeFileSync(
  join(raw, "gas.ndjson"),
  '{"countyFips":"48453","gasPipelineMileageCounty":1,"gasPipelinePresenceFlag":true}\n'
);
console.log(
  JSON.stringify(
    normalizeCountyPowerBundle({
      normalizedDir: norm,
      normalizedManifestPath: join(norm, "normalized-manifest.json"),
      rawManifestPath: join(raw, "bundle-manifest.json"),
    }).gas
  )
);

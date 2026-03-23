import { createHash } from "node:crypto";
import type { FacilitiesDatasetManifest } from "@map-migration/http-contracts/facilities-http";
import { getApiRuntimeConfig } from "@/http/runtime-config";

export function buildFacilitiesDatasetManifest(): FacilitiesDatasetManifest {
  const runtimeConfig = getApiRuntimeConfig();

  return {
    dataset: "facilities",
    publishedAt: runtimeConfig.facilitiesDatasetPublishedAt,
    current: {
      version: runtimeConfig.facilitiesDatasetVersion,
      ...(runtimeConfig.facilitiesWarmProfileVersion !== null
        ? { warmProfileVersion: runtimeConfig.facilitiesWarmProfileVersion }
        : {}),
    },
    ...(runtimeConfig.facilitiesDatasetPreviousVersion !== null
      ? {
          previous: {
            version: runtimeConfig.facilitiesDatasetPreviousVersion,
          },
        }
      : {}),
  };
}

export function buildFacilitiesDatasetManifestEtag(manifest: FacilitiesDatasetManifest): string {
  return `"${createHash("sha1").update(JSON.stringify(manifest)).digest("hex")}"`;
}

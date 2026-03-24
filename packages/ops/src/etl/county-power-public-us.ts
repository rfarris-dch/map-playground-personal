import { extractCountyPowerPublicUs as extractCountyPowerPublicUsImplementation } from "./county-power-public-us.impl.js";
import type {
  CountyPowerPublicUsExtractOptions,
  CountyPowerPublicUsExtractResult,
} from "./county-power-public-us.types";
import { decodeCountyPowerBundleManifest } from "./county-power-sync";

export async function extractCountyPowerPublicUs(
  options: CountyPowerPublicUsExtractOptions
): Promise<CountyPowerPublicUsExtractResult> {
  const result = await extractCountyPowerPublicUsImplementation(options);

  return {
    dataVersion: result.dataVersion,
    effectiveDate: result.effectiveDate,
    manifest: decodeCountyPowerBundleManifest(result.manifest),
    manifestPath: result.manifestPath,
    manifestUrl: result.manifestUrl,
    month: result.month,
  };
}

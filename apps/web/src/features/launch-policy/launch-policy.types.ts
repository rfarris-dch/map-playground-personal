import type { ApiResult } from "@map-migration/core-runtime/api";
import type {
  LaunchPolicyResponse,
  ValidatedCorridorMarket,
} from "@map-migration/http-contracts/launch-policy-http";

export interface LaunchPolicyMarketTreatment {
  readonly isValidated: boolean;
  readonly label: string;
  readonly marketId: string | null;
  readonly marketName: string | null;
  readonly summary: string;
}

export type LaunchPolicyModel = LaunchPolicyResponse;
export type LaunchPolicyFetchResult = ApiResult<LaunchPolicyResponse>;
export type LaunchPolicyValidatedMarket = ValidatedCorridorMarket;

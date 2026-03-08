import type { ResponseMeta } from "@map-migration/contracts";

export interface CountyScoresResponseMetaArgs {
  readonly dataVersion?: string | null | undefined;
  readonly recordCount: number;
  readonly requestId: string;
}

export interface CountyScoresQueryParams {
  readonly countyIds: readonly string[];
}

export type CountyScoresQueryParamsResult =
  | {
      readonly ok: true;
      readonly value: CountyScoresQueryParams;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

export type BuildCountyScoresResponseMeta = (args: CountyScoresResponseMetaArgs) => ResponseMeta;

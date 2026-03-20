export interface HyperscaleAggregationPoint {
  readonly live: boolean;
  readonly owned: number | null;
  readonly planned: number | null;
  readonly quarter: number;
  readonly underConstruction: number | null;
  readonly year: number;
}

export interface HyperscaleRegionalAggregationPoint extends HyperscaleAggregationPoint {
  readonly regionId: number;
}

export interface HyperscaleLeasedDataPoint {
  readonly companyId: string;
  readonly companyName: string;
  readonly leaseTotal: number;
  readonly year: number;
}

export interface HyperscaleLeasedResponse {
  readonly data: readonly HyperscaleLeasedDataPoint[];
  readonly id: string;
  readonly name: string;
}

export interface HyperscaleAggregationRow {
  readonly owned_power: number | string | null;
  readonly planned_power: number | string | null;
  readonly quarter_num: number | string;
  readonly uc_power: number | string | null;
  readonly year_num: number | string;
}

export interface HyperscaleRegionalAggregationRow extends HyperscaleAggregationRow {
  readonly region_id: number | string;
}

export interface HyperscaleLeasedRow {
  readonly company_name: string;
  readonly company_source_id: string;
  readonly lease_total: number | string;
  readonly market_name: string;
  readonly year_num: number | string;
}

export interface CompanyResolutionRow {
  readonly company_id: string;
  readonly source_pk: string;
}

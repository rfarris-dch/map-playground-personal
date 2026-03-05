export interface BoundaryPowerRow {
  readonly commissioned_power_mw: number | string | null | undefined;
  readonly geom_json: unknown;
  readonly parent_region_name: string | null | undefined;
  readonly region_id: string;
  readonly region_name: string | null | undefined;
}

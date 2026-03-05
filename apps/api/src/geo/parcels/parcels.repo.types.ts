export interface ParcelRow {
  readonly attrs_json: unknown;
  readonly geoid: string | null | undefined;
  readonly geom_json: unknown;
  readonly ingestion_run_id: string | null | undefined;
  readonly parcel_id: string;
  readonly source_oid: number | string | null | undefined;
  readonly source_updated_at: Date | string | null | undefined;
  readonly state2: string | null | undefined;
}

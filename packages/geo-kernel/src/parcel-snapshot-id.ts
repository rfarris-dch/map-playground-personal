export interface ParcelSnapshotId {
  readonly parcelId: string;
  readonly ingestionRunId: string;
}

export function makeParcelSnapshotId(parcelId: string, ingestionRunId: string): ParcelSnapshotId {
  return { parcelId, ingestionRunId };
}

export function parseParcelSnapshotId(value: unknown): ParcelSnapshotId | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.parcelId !== "string" || record.parcelId.length === 0) {
    return null;
  }

  if (typeof record.ingestionRunId !== "string" || record.ingestionRunId.length === 0) {
    return null;
  }

  return { parcelId: record.parcelId, ingestionRunId: record.ingestionRunId };
}

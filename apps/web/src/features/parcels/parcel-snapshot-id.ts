interface ParcelSnapshotId {
  readonly ingestionRunId: string;
  readonly parcelId: string;
}

export function makeParcelSnapshotId(parcelId: string, ingestionRunId: string): ParcelSnapshotId {
  return { parcelId, ingestionRunId };
}

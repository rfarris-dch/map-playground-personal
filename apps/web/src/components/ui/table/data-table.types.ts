import type { RowData, SortingState, TableOptionsWithReactiveData } from "@tanstack/vue-table";

export type DataTableColumns<TEntry extends RowData> = Exclude<
  TableOptionsWithReactiveData<TEntry>["columns"],
  undefined
>;

export type ColumnLabelById = Readonly<Record<string, string>>;

export type FacetSelectionState = Readonly<Record<string, readonly string[]>>;

export interface PersistedDataTableState {
  readonly f?: FacetSelectionState | undefined;
  readonly g?: readonly string[] | undefined;
  readonly q?: string | undefined;
  readonly s?: SortingState | undefined;
  readonly v?: readonly string[] | undefined;
  readonly x?: readonly string[] | undefined;
}

export interface FacetValue {
  readonly count: number;
  readonly label: string;
  readonly token: string;
}

export interface FacetableColumn {
  readonly columnId: string;
  readonly columnLabel: string;
  readonly values: readonly FacetValue[];
}

export interface GroupableColumnOption {
  readonly columnId: string;
  readonly columnLabel: string;
}

export interface HideableColumnOption {
  readonly columnId: string;
  readonly columnLabel: string;
  readonly setVisible: (visible: boolean) => void;
  readonly visible: boolean;
}

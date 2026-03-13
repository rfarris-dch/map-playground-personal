import type { InjectionKey } from "vue";
import type { UseMapFiltersResult } from "./use-map-filters";

export const MAP_FILTERS_KEY: InjectionKey<UseMapFiltersResult> = Symbol("map-filters");

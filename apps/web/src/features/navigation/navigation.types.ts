export type AppNavigationId = "facilities" | "map" | "markets" | "providers";

export interface AppNavigationItem {
  readonly label: string;
  readonly navigationId: AppNavigationId;
  readonly routeName: string;
  readonly to: string;
}

export interface FacilityNavigationItem {
  readonly description: string;
  readonly label: string;
  readonly routeName: string;
  readonly to: string;
}

export interface FacilityDetailRouteParams {
  readonly facilityId: string;
  readonly perspective: string;
}

export interface ProviderDetailRouteParams {
  readonly providerId: string;
}

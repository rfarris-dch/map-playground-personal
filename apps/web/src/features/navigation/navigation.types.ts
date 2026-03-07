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

export interface MarketMapRouteParams {
  readonly marketSlug: string;
}

export interface CompanyMapRouteParams {
  readonly companyKind: string;
  readonly companySlug: string;
}

export interface CompanyDashboardRouteParams {
  readonly companyKind: string;
  readonly companySlug: string;
}

export interface MarketDashboardRouteParams {
  readonly marketSlug: string;
}

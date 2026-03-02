export interface BasemapProfile {
  readonly buildingSourceLayer: string;
  readonly buildingsLayerId: string;
  readonly buildingsMinZoom: number;
  readonly buildingsOpacity: number;
  readonly styleUrl: string;
}

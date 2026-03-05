export interface StyleDocument {
  layers: StyleLayer[];
  name: string;
  sources: Record<string, object>;
  version: 8;
}

export interface StyleLayer {
  id: string;
  layout?: Record<string, unknown>;
  maxzoom?: number;
  minzoom?: number;
  paint?: Record<string, unknown>;
  source?: string;
  "source-layer"?: string;
  type: string;
}

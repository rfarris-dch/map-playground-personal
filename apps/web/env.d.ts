/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DISABLE_PARCELS_GUARDRAILS?: string;
  readonly VITE_SATELLITE_BASEMAP_URL?: string;
  readonly VITE_SATELLITE_BASEMAP_URLS?: string;
  readonly VITE_SATELLITE_MAX_ZOOM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

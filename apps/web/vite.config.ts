import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const defaultApiProxyTarget = "http://localhost:3001";
const apiProxyTarget =
  process.env.MAP_WEB_API_PROXY_TARGET ??
  process.env.VITE_API_PROXY_TARGET ??
  defaultApiProxyTarget;
const mapWebPort = Number(process.env.MAP_WEB_PORT ?? "5143");
const useExternalTileManifests = process.env.VITE_TILE_MANIFEST_MODE === "external";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
  },
  publicDir: useExternalTileManifests ? "public-static" : "public",
  resolve: {
    dedupe: ["maplibre-gl"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: Number.isFinite(mapWebPort) ? mapWebPort : 5143,
    strictPort: true,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});

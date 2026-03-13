import http from "node:http";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const defaultApiProxyTarget = "http://127.0.0.1:3001";
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
        configure: (proxy) => {
          // Defer to run after Vite registers its own error handler, then
          // replace all error listeners with a silent one so ECONNREFUSED
          // noise never hits the console during API restarts.
          process.nextTick(() => {
            proxy.removeAllListeners("error");
            proxy.on("error", (_err, _req, res) => {
              if (res instanceof http.ServerResponse && !res.headersSent) {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "API unavailable — it may be restarting" }));
              }
            });
          });
        },
      },
    },
  },
});

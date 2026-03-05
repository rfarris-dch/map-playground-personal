import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const pipelineMonitorPort = Number(process.env.MAP_PIPELINE_MONITOR_PORT ?? "5144");

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: Number.isFinite(pipelineMonitorPort) ? pipelineMonitorPort : 5144,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});

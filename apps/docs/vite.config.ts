import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const docsPort = Number(process.env.MAP_DOCS_PORT ?? "5145");

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: Number.isFinite(docsPort) ? docsPort : 5145,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: Number.isFinite(docsPort) ? docsPort : 5145,
    strictPort: true,
  },
});

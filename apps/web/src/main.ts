import { VueQueryPlugin } from "@tanstack/vue-query";
import "maplibre-gl/dist/maplibre-gl.css";
import { createApp } from "vue";
import App from "./app.vue";
import { appRouter } from "./app-router";
import { createQueryClient } from "./lib/query-client";
import "./style.css";

const app = createApp(App);
app.use(VueQueryPlugin, { queryClient: createQueryClient() });
app.use(appRouter);
app.mount("#app");

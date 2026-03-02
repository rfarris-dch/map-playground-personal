import { VueQueryPlugin } from "@tanstack/vue-query";
import "maplibre-gl/dist/maplibre-gl.css";
import { createApp } from "vue";
import App from "./app.vue";
import { createQueryClient } from "./lib/query-client";
import "./style.css";

const app = createApp(App);
app.use(VueQueryPlugin, { queryClient: createQueryClient() });
app.mount("#app");

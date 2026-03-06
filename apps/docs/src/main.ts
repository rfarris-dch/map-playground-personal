import { createApp } from "vue";
import App from "@/app.vue";
import { docsRouter } from "@/router";
import "@/styles/tailwind.css";

const app = createApp(App);
app.use(docsRouter);
app.mount("#app");

<script setup lang="ts">
  import { computed } from "vue";
  import blurCyanImage from "@/assets/blur-cyan.png";
  import blurIndigoImage from "@/assets/blur-indigo.png";
  import HeroBackground from "@/features/docs/components/hero-background.vue";

  interface HeroTab {
    readonly isActive: boolean;
    readonly name: string;
  }

  const tabs: readonly HeroTab[] = [
    { name: "apps/web", isActive: true },
    { name: "apps/api", isActive: false },
    { name: "apps/pipeline-monitor", isActive: false },
  ];

  const heroCode = `export const docsMap = {
  web: "/docs/applications/web-runtime",
  api: "/docs/applications/api-runtime",
  monitor: "/docs/applications/pipeline-monitor",
  packages: "/docs/packages/core-runtime",
  operations: "/docs/operations/runbooks-and-troubleshooting",
};`;
  const heroCodeLines = computed(() => heroCode.split("\n"));
</script>

<template>
  <div class="overflow-hidden bg-slate-900 dark:-mt-19 dark:-mb-32 dark:pt-19 dark:pb-32">
    <div class="py-16 sm:px-2 lg:relative lg:px-0 lg:py-20">
      <div
        class="mx-auto grid max-w-2xl grid-cols-1 items-center gap-x-8 gap-y-16 px-4 lg:max-w-8xl lg:grid-cols-2 lg:px-8 xl:gap-x-16 xl:px-12"
      >
        <div class="relative z-10 md:text-center lg:text-left">
          <img
            class="absolute right-full bottom-full -mr-72 -mb-56 opacity-50"
            :src="blurCyanImage"
            alt=""
            width="530"
            height="530"
          >
          <div class="relative">
            <p
              class="inline bg-linear-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-5xl tracking-tight text-transparent"
            >
              Technical docs for the datacenterHawk map platform.
            </p>
            <p class="mt-3 text-2xl tracking-tight text-slate-400">
              Reference the web app, API, pipeline monitor, and shared packages in one place, with
              links back to the source files behind each area.
            </p>
            <div class="mt-8 flex gap-4 md:justify-center lg:justify-start">
              <RouterLink
                to="/docs/getting-started/workspace-and-commands"
                class="rounded-full bg-sky-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/50 active:bg-sky-500"
              >
                Workspace guide
              </RouterLink>
              <RouterLink
                to="/docs/applications/web-runtime"
                class="rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 active:text-slate-400"
              >
                Open web runtime docs
              </RouterLink>
            </div>
          </div>
        </div>
        <div class="relative lg:static xl:pl-10">
          <div
            class="absolute inset-x-[-50vw] -top-32 -bottom-48 mask-[linear-gradient(transparent,white,white)] lg:-top-32 lg:right-0 lg:-bottom-32 lg:left-[calc(50%+14rem)] lg:mask-none dark:mask-[linear-gradient(transparent,white,transparent)] lg:dark:mask-[linear-gradient(white,white,transparent)]"
          >
            <HeroBackground
              class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 lg:left-0 lg:translate-x-0 lg:translate-y-[-60%]"
            />
          </div>
          <div class="relative">
            <img
              class="absolute -top-64 -right-64"
              :src="blurCyanImage"
              alt=""
              width="530"
              height="530"
            >
            <img
              class="absolute -right-44 -bottom-40"
              :src="blurIndigoImage"
              alt=""
              width="567"
              height="567"
            >
            <div
              class="absolute inset-0 rounded-2xl bg-linear-to-tr from-sky-300 via-sky-300/70 to-blue-300 opacity-10 blur-lg"
            />
            <div
              class="absolute inset-0 rounded-2xl bg-linear-to-tr from-sky-300 via-sky-300/70 to-blue-300 opacity-10"
            />
            <div class="relative rounded-2xl bg-[#0A101F]/80 ring-1 ring-white/10 backdrop-blur-sm">
              <div
                class="absolute -top-px right-11 left-20 h-px bg-linear-to-r from-sky-300/0 via-sky-300/70 to-sky-300/0"
              />
              <div
                class="absolute right-20 -bottom-px left-11 h-px bg-linear-to-r from-blue-400/0 via-blue-400 to-blue-400/0"
              />
              <div class="pt-4 pl-4">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 42 10"
                  fill="none"
                  class="h-2.5 w-auto stroke-slate-500/30"
                >
                  <circle cx="5" cy="5" r="4.5" />
                  <circle cx="21" cy="5" r="4.5" />
                  <circle cx="37" cy="5" r="4.5" />
                </svg>
                <div class="mt-4 flex space-x-2 text-xs">
                  <div
                    v-for="tab in tabs"
                    :key="tab.name"
                    class="flex h-6 rounded-full"
                    :class="
                      tab.isActive
                        ? 'bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 p-px font-medium text-sky-300'
                        : 'text-slate-500'
                    "
                  >
                    <div
                      class="flex items-center rounded-full px-2.5"
                      :class="tab.isActive ? 'bg-slate-800' : ''"
                    >
                      {{ tab.name }}
                    </div>
                  </div>
                </div>
                <div class="mt-6 flex items-start px-1 text-sm">
                  <div
                    aria-hidden="true"
                    class="border-r border-slate-300/5 pr-4 font-mono text-slate-600 select-none"
                  >
                    <template v-for="(line, index) in heroCodeLines" :key="`${line}-${index}`">
                      {{ String(index + 1).padStart(2, "0") }}<br>
                    </template>
                  </div>
                  <pre
                    class="flex overflow-x-auto pb-6 text-sm text-slate-50"
                  ><code class="language-ts px-4">{{ heroCode }}</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

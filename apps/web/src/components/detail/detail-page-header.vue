<script setup lang="ts">
  import { ArrowLeft } from "lucide-vue-next";
  import { useRouter } from "vue-router";
  import Button from "@/components/ui/button/button.vue";

  defineProps<{
    readonly title: string;
    readonly eyebrow?: string;
    readonly eyebrowClass?: string;
  }>();

  const router = useRouter();

  function goBack(): void {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }
</script>

<template>
  <header class="space-y-3">
    <nav v-if="$slots.breadcrumbs" class="text-xs text-muted-foreground">
      <slot name="breadcrumbs" />
    </nav>

    <div class="flex items-start gap-3">
      <Button variant="ghost" size="icon" class="mt-0.5 shrink-0" @click="goBack">
        <ArrowLeft class="h-4 w-4" />
        <span class="sr-only">Go back</span>
      </Button>

      <div class="min-w-0 flex-1">
        <p
          v-if="eyebrow"
          class="truncate text-xs font-medium uppercase tracking-wider"
          :class="eyebrowClass ?? 'text-muted-foreground'"
        >
          {{ eyebrow }}
        </p>
        <h1 class="truncate text-2xl font-bold tracking-tight" :title="title">{{ title }}</h1>

        <div v-if="$slots.subtitle" class="mt-1"><slot name="subtitle" /></div>
      </div>

      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>

    <div v-if="$slots.badges" class="flex flex-wrap items-center gap-2 pl-10">
      <slot name="badges" />
    </div>
  </header>
</template>

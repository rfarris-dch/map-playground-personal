<script setup lang="ts">
  import Card from "@/components/ui/card/card.vue";
  import CardContent from "@/components/ui/card/card-content.vue";
  import CardHeader from "@/components/ui/card/card-header.vue";
  import CardTitle from "@/components/ui/card/card-title.vue";

  export interface DetailField {
    readonly label: string;
    readonly value: string | number | null;
  }

  defineProps<{
    readonly title: string;
    readonly fields: readonly DetailField[];
  }>();

  function formatValue(value: string | number | null): string {
    if (value === null || value === undefined) {
      return "--";
    }
    return String(value);
  }
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ title }}</CardTitle>
    </CardHeader>
    <CardContent>
      <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="field in fields" :key="field.label">
          <dt class="text-xs font-medium text-muted-foreground">{{ field.label }}</dt>
          <dd class="m-0 mt-0.5 text-sm">{{ formatValue(field.value) }}</dd>
        </div>
      </dl>
    </CardContent>
  </Card>
</template>

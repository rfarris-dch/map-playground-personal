<script setup lang="ts">
  import { cva, type VariantProps } from "class-variance-authority";
  import { computed } from "vue";
  import { cn } from "@/lib/utils";

  const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
    {
      variants: {
        variant: {
          default: "border-transparent bg-primary text-primary-foreground",
          secondary: "border-transparent bg-secondary text-secondary-foreground",
          outline: "border-border bg-transparent text-foreground",
          muted: "border-border bg-muted text-muted-foreground",
        },
      },
      defaultVariants: {
        variant: "default",
      },
    }
  );

  type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

  interface BadgeProps {
    variant?: BadgeVariant;
  }

  const props = withDefaults(defineProps<BadgeProps>(), {
    variant: "default",
  });

  const className = computed(() => cn(badgeVariants({ variant: props.variant })));
</script>

<template>
  <span :class="className"><slot /></span>
</template>

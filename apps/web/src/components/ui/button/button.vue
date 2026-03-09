<script setup lang="ts">
  import { cva, type VariantProps } from "class-variance-authority";
  import { computed, useAttrs } from "vue";
  import { cn } from "@/lib/utils";

  function normalizeClassValue(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => normalizeClassValue(item))
        .filter((item) => item.length > 0)
        .join(" ");
    }

    if (typeof value === "object" && value !== null) {
      return Object.entries(value)
        .filter((entry) => Boolean(entry[1]))
        .map((entry) => entry[0])
        .join(" ");
    }

    return "";
  }

  const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    {
      variants: {
        variant: {
          default: "bg-primary text-primary-foreground hover:bg-primary/90",
          glass: "map-glass-button border-transparent text-foreground/90 hover:text-foreground",
          "glass-active":
            "map-glass-button map-glass-button-active border-transparent text-foreground",
          secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          outline:
            "border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground",
          ghost: "hover:bg-accent hover:text-accent-foreground",
        },
        size: {
          default: "h-9 px-4 py-2",
          sm: "h-8 rounded-md px-3 text-xs",
          lg: "h-10 rounded-md px-8",
          icon: "h-9 w-9",
        },
      },
      defaultVariants: {
        variant: "default",
        size: "default",
      },
    }
  );

  type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
  type ButtonSize = VariantProps<typeof buttonVariants>["size"];

  interface ButtonProps {
    size?: ButtonSize;
    type?: "button" | "submit" | "reset";
    variant?: ButtonVariant;
  }

  const props = withDefaults(defineProps<ButtonProps>(), {
    variant: "default",
    size: "default",
    type: "button",
  });

  const attrs = useAttrs();

  const forwardedAttrs = computed(() => {
    const { class: _class, ...rest } = attrs;
    return rest;
  });

  const className = computed(() =>
    cn(
      buttonVariants({ variant: props.variant, size: props.size }),
      normalizeClassValue(attrs.class)
    )
  );
</script>

<template>
  <button :type="props.type" :class="className" v-bind="forwardedAttrs"><slot /></button>
</template>

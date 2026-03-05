<script setup lang="ts">
  import { DropdownMenuRoot } from "reka-ui";
  import { computed } from "vue";

  interface DropdownMenuProps {
    readonly modal?: boolean;
    readonly open?: boolean;
  }

  const props = withDefaults(defineProps<DropdownMenuProps>(), {
    modal: false,
  });

  const emit = defineEmits<{
    "update:open": [value: boolean];
  }>();

  const rootProps = computed(() => {
    const nextProps: { modal: boolean; open?: boolean } = {
      modal: props.modal,
    };

    if (typeof props.open === "boolean") {
      nextProps.open = props.open;
    }

    return nextProps;
  });

  function handleOpenChange(nextOpen: boolean): void {
    emit("update:open", nextOpen);
  }
</script>

<template>
  <DropdownMenuRoot v-bind="rootProps" @update:open="handleOpenChange"> <slot /> </DropdownMenuRoot>
</template>

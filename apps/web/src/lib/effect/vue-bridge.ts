import { Effect } from "effect";
import type { Ref, ShallowRef } from "vue";

export type WritableVueRef<TValue> = Ref<TValue> | ShallowRef<TValue>;

export function mutateVueState<TValue>(mutate: () => TValue) {
  return Effect.sync(mutate);
}

export function setVueRef<TValue>(target: WritableVueRef<TValue>, value: TValue) {
  return Effect.sync(() => {
    target.value = value;
  });
}

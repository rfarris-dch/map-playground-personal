import type { IMap } from "@map-migration/map-engine";
import { Effect } from "effect";

type MapLifecycleEvent = Parameters<IMap["on"]>[0];
type MapLifecycleHandler = Parameters<IMap["on"]>[1];

export function listenToMapEvent(
  map: IMap,
  event: MapLifecycleEvent,
  handler: MapLifecycleHandler
) {
  return Effect.acquireRelease(
    Effect.sync(() => {
      map.on(event, handler);
    }),
    () =>
      Effect.sync(() => {
        map.off(event, handler);
      })
  );
}

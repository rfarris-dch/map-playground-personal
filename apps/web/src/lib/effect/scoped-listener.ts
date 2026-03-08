import type { IMap } from "@map-migration/map-engine";
import { Effect } from "effect";

type MapLifecycleEvent = Parameters<IMap["on"]>[0];
type MapLifecycleHandler = Parameters<IMap["on"]>[1];

export function listenToEventTarget(
  target: EventTarget,
  event: string,
  handler: EventListenerOrEventListenerObject,
  options?: AddEventListenerOptions | boolean
) {
  return Effect.acquireRelease(
    Effect.sync(() => {
      target.addEventListener(event, handler, options);
    }),
    () =>
      Effect.sync(() => {
        target.removeEventListener(event, handler, options);
      })
  );
}

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

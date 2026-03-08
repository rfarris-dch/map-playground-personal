import { Effect } from "effect";
import { createMap, registerPmtilesProtocol, type IMap, type MapAdapter, type MapCreateOptions } from "./index";

export function registerPmtilesProtocolScoped() {
  return Effect.acquireRelease(
    Effect.sync(() => registerPmtilesProtocol()),
    (disposePmtilesProtocol) => Effect.sync(() => disposePmtilesProtocol())
  ).pipe(Effect.asVoid);
}

export function createMapScoped(
  adapter: MapAdapter,
  container: HTMLElement,
  options: MapCreateOptions
) {
  return Effect.acquireRelease(
    Effect.sync(() => createMap(adapter, container, options)),
    (map: IMap) => Effect.sync(() => map.destroy())
  );
}

import { acquireRelease, asVoid, sync } from "effect/Effect";
import {
  createMap,
  type IMap,
  type MapAdapter,
  type MapCreateOptions,
  registerPmtilesProtocol,
} from "./index";

export function registerPmtilesProtocolScoped() {
  return acquireRelease(
    sync(() => registerPmtilesProtocol()),
    (disposePmtilesProtocol) => sync(() => disposePmtilesProtocol())
  ).pipe(asVoid);
}

export function createMapScoped(
  adapter: MapAdapter,
  container: HTMLElement,
  options: MapCreateOptions
) {
  return acquireRelease(
    sync(() => createMap(adapter, container, options)),
    (map: IMap) => sync(() => map.destroy())
  );
}

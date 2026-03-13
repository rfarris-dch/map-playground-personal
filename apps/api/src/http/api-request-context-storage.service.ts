import { AsyncLocalStorage } from "node:async_hooks";

export interface ApiRequestContextStorageValue {
  readonly requestId: string;
  readonly signal: AbortSignal;
}

const apiRequestContextStorage = new AsyncLocalStorage<ApiRequestContextStorageValue>();

export function runWithApiRequestContextStorage<TValue>(
  value: ApiRequestContextStorageValue,
  callback: () => TValue
): TValue {
  return apiRequestContextStorage.run(value, callback);
}

export function readApiRequestContextStorage(): ApiRequestContextStorageValue | null {
  return apiRequestContextStorage.getStore() ?? null;
}

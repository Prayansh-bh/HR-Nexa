import { useSyncExternalStore, useCallback } from "react";

// Global store registry mapping localStorage keys to listener sets & memory cache
const storeCache = new Map<string, { value: any; listeners: Set<() => void> }>();

function getStore<T>(key: string, initial: T) {
  let store = storeCache.get(key);
  if (!store) {
    let initialVal = initial;
    if (typeof window !== "undefined") {
      try {
        const item = window.localStorage.getItem(key);
        if (item !== null) {
          initialVal = JSON.parse(item);
        }
      } catch {
        /* ignore */
      }
    }
    store = { value: initialVal, listeners: new Set() };
    storeCache.set(key, store);

    if (typeof window !== "undefined") {
      const handleStorageUpdate = (e: StorageEvent | CustomEvent) => {
        const updateKey = (e as StorageEvent).key || (e as CustomEvent).detail?.key;
        if (updateKey === key) {
          try {
            const raw = window.localStorage.getItem(key);
            store!.value = raw !== null ? JSON.parse(raw) : initial;
            store!.listeners.forEach((l) => l());
          } catch {
            /* ignore */
          }
        }
      };

      window.addEventListener("storage", handleStorageUpdate as EventListener);
      window.addEventListener("local-storage", handleStorageUpdate as EventListener);
    }
  }
  return store;
}

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const store = getStore<T>(key, initial);

  const subscribe = useCallback(
    (listener: () => void) => {
      store.listeners.add(listener);
      return () => {
        store.listeners.delete(listener);
      };
    },
    [store],
  );

  const getSnapshot = useCallback(() => store.value, [store]);

  const value = useSyncExternalStore(subscribe, getSnapshot, () => initial);

  const setValue = useCallback(
    (val: T | ((p: T) => T)) => {
      try {
        const nextValue = val instanceof Function ? val(store.value) : val;
        store.value = nextValue;
        if (typeof window !== "undefined") {
          if (nextValue === null || nextValue === undefined) {
            window.localStorage.removeItem(key);
          } else {
            window.localStorage.setItem(key, JSON.stringify(nextValue));
          }
        }
        store.listeners.forEach((l) => l());
      } catch {
        /* ignore */
      }
    },
    [key, store],
  );

  return [value, setValue];
}

"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "yev-header-collapsed";

// Same approach as useSidebarCollapse: useSyncExternalStore over localStorage, SSR renders expanded.
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

export function useHeaderCollapse() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, getSnapshot() ? "0" : "1");
    } catch {
      // Storage blocked (private mode): only persistence is lost.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return { collapsed, toggle };
}

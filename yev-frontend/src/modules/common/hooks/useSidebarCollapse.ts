"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "yev-sidebar-collapsed";

export const SIDEBAR_WIDTH_EXPANDED = "13.75rem";
export const SIDEBAR_WIDTH_COLLAPSED = "4.5rem";

function applyWidthVar(collapsed: boolean) {
  document.documentElement.style.setProperty(
    "--sidebar-w",
    collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED
  );
}

// useSyncExternalStore over localStorage avoids setState in effect and stays SSR-safe (server = expanded).
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot(): boolean {
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

function getServerSnapshot(): boolean {
  return false;
}

export function useSidebarCollapse() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Pure DOM side effect, no setState.
  useEffect(() => {
    applyWidthVar(collapsed);
  }, [collapsed]);

  const toggle = useCallback(() => {
    const next = !getSnapshot();
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    listeners.forEach((listener) => listener());
  }, []);

  return { collapsed, toggle };
}

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

// Đọc trạng thái từ localStorage (external store) qua useSyncExternalStore thay vì
// useState+useEffect — tránh phải setState đồng bộ trong effect (react-hooks/set-state-in-effect)
// và vẫn an toàn với SSR (getServerSnapshot trả mặc định "mở rộng" khi render phía server).
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

  // Đồng bộ biến CSS ra DOM — thuần side-effect trên external system (DOM), không setState.
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

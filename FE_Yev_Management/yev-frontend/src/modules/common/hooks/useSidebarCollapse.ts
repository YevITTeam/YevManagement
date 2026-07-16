"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "yev-sidebar-collapsed";

export const SIDEBAR_WIDTH_EXPANDED = "13.75rem";
export const SIDEBAR_WIDTH_COLLAPSED = "4.5rem";

function applyWidthVar(collapsed: boolean) {
  document.documentElement.style.setProperty(
    "--sidebar-w",
    collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED
  );
}

export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) === "1";
    setCollapsed(stored);
    applyWidthVar(stored);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      applyWidthVar(next);
      return next;
    });
  }, []);

  return { collapsed, toggle };
}

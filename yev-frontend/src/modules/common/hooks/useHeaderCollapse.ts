"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "yev-header-collapsed";

// Cùng khuôn với useSidebarCollapse: đọc localStorage qua useSyncExternalStore (không setState trong effect,
// an toàn SSR — server luôn render "đang mở"). Thu gọn Header để nhường thêm chiều dọc cho nội dung.
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
      // storage bị chặn (chế độ riêng tư…) — chỉ mất việc nhớ trạng thái, không ảnh hưởng UI.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return { collapsed, toggle };
}

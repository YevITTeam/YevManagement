"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

// Tab lives in sessionStorage (SSR-safe via useSyncExternalStore) so refresh / language switch keep it.
// Saved values that are not in `allowed` (permission changed, tab removed) fall back to `fallback`.
export function usePersistedTab<T extends string>(storageKey: string, allowed: readonly T[], fallback: T): [T, (tab: T) => void] {
    const getSnapshot = useCallback(() => {
        try {
            return window.sessionStorage.getItem(storageKey);
        } catch {
            return null;
        }
    }, [storageKey]);
    const saved = useSyncExternalStore(subscribe, getSnapshot, () => null);
    const tab = allowed.find((key) => key === saved) ?? fallback;

    const setTab = useCallback(
        (next: T) => {
            try {
                window.sessionStorage.setItem(storageKey, next);
            } catch {}
            listeners.forEach((listener) => listener());
        },
        [storageKey]
    );

    return [tab, setTab];
}

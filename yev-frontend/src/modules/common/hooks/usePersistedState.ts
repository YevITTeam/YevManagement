"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
// Fallback when sessionStorage throws (blocked storage), so state still changes for this page's lifetime.
const memory = new Map<string, string>();

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

function read(key: string): string | null {
    if (memory.has(key)) return memory.get(key)!;
    try {
        return window.sessionStorage.getItem(key);
    } catch {
        return null;
    }
}

function parse<T>(raw: string | null, initial: T): T {
    if (raw === null) return initial;
    try {
        const value = JSON.parse(raw) as T;
        // Fields added to a filter object after it was saved fall back to their defaults.
        if (initial && typeof initial === "object" && !Array.isArray(initial) && value && typeof value === "object") return { ...initial, ...value };
        return value;
    } catch {
        return initial;
    }
}

// useState kept in sessionStorage (per browser tab): a list keeps its filters, page and page size after
// opening a detail page and coming back, and across F5. SSR-safe like usePersistedTab.
export function usePersistedState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
    const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `initial` is a default, not an input.
    const value = useMemo(() => parse(raw, initial), [raw]);

    const setValue = useCallback(
        (next: T | ((prev: T) => T)) => {
            const resolved = typeof next === "function" ? (next as (prev: T) => T)(parse(read(key), initial)) : next;
            write(key, JSON.stringify(resolved));
            listeners.forEach((listener) => listener());
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [key]
    );

    return [value, setValue];
}

function write(key: string, serialized: string) {
    memory.set(key, serialized);
    try {
        window.sessionStorage.setItem(key, serialized);
    } catch {}
}

// For lists that reset filters during render (plain useState there): restore once in a useState initializer, save with
// usePersistOnChange. Only valid in components that mount client-side, which every list behind an access guard does.
export function readPersisted<T>(key: string): Partial<T> | null {
    return parse<Partial<T> | null>(read(key), null);
}

export function usePersistOnChange(key: string, value: unknown) {
    const serialized = JSON.stringify(value);
    useEffect(() => write(key, serialized), [key, serialized]);
}

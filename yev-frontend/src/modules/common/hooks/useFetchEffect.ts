"use client";

import { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/apiError";

// Module-level SWR cache lives for the tab session; no TTL/eviction needed at this app's data sizes.
const cacheStore = new Map<string, unknown>();

// react-hooks/set-state-in-effect only allows setState inside .then()/.catch()/.finally(), so loading/error reset
// uses a render-time deps snapshot. With `cacheKey`, cached data shows instantly and refetches in the background.
export function useFetchEffect<T>(
    fetcher: () => Promise<T>,
    deps: readonly unknown[],
    onSuccess: (data: T) => void,
    errorFallback: string,
    onError?: (message: string) => void,
    cacheKey?: string
) {
    const depsKey = JSON.stringify(deps);
    const fullCacheKey = cacheKey ? `${cacheKey}:${depsKey}` : null;
    const hasCachedEntry = fullCacheKey !== null && cacheStore.has(fullCacheKey);

    const [isLoading, setIsLoading] = useState(!hasCachedEntry);
    const [error, setError] = useState<string | null>(null);

    const [snapshot, setSnapshot] = useState(depsKey);
    if (snapshot !== depsKey) {
        setSnapshot(depsKey);
        setIsLoading(!hasCachedEntry);
        setError(null);
    }

    const runFetch = () => {
        return fetcher()
            .then((data) => {
                if (fullCacheKey) {
                    cacheStore.set(fullCacheKey, data);
                }
                onSuccess(data);
            })
            .catch((err) => {
                console.error(err);
                const message = getApiErrorMessage(err, errorFallback);
                setError(message);
                onError?.(message);
            })
            .finally(() => {
                setIsLoading(false);
            });
    };

    useEffect(() => {
        if (fullCacheKey && cacheStore.has(fullCacheKey)) {
            const cached = cacheStore.get(fullCacheKey) as T;
            // Wrapped in .then() to satisfy set-state-in-effect.
            Promise.resolve(cached).then((data) => {
                onSuccess(data);
            });
        }
        runFetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [depsKey]);

    // setState in an event handler is allowed, so isLoading flips immediately.
    const refetch = () => {
        setIsLoading(true);
        setError(null);
        return runFetch();
    };

    return { isLoading, error, refetch };
}

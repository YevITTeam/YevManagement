"use client";

import { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/apiError";

// Cache stale-while-revalidate cho tham số `cacheKey` (opt-in) — module-level nên sống suốt phiên
// tab (mất khi F5/đóng tab), không cần TTL/eviction vì quy mô danh mục của app này nhỏ.
const cacheStore = new Map<string, unknown>();

// Pattern chuẩn để fetch dữ liệu trong list/detail/panel — xem CLAUDE.md "Pattern fetch dữ liệu".
// Lý do cần hook này thay vì viết `fetchXxx` async/await gọi thẳng trong `useEffect` (cách cũ): rule
// `react-hooks/set-state-in-effect` (React Compiler) chỉ cho phép effect gọi hàm setState bên trong
// `.then()/.catch()/.finally()`, không cho phép gọi `async function` (kể cả khi setState nằm sau
// `await`). Hook tự bật lại `isLoading`/xoá `error` mỗi khi `deps` đổi bằng cách so sánh "snapshot"
// NGAY TRONG RENDER — cách React chính thức khuyến khích thay effect để "phản ứng" theo state khác
// (xem https://react.dev/learn/you-might-not-need-an-effect) — rồi effect chỉ còn việc gọi `fetcher`
// (một promise chain thuần, không async/await) để đổ dữ liệu.
//
// `cacheKey` (optional): khi truyền, hook nhớ kết quả lần fetch gần nhất trong `cacheStore` (key thực
// tế = `${cacheKey}:${depsKey}` để tách theo từng tổ hợp filter/trang). Lần sau mount lại với cùng
// `cacheKey`+`deps`, hook trả dữ liệu cũ NGAY (không bật `isLoading`) rồi âm thầm gọi lại `fetcher` ở
// nền để cập nhật — không truyền `cacheKey` thì hành vi y hệt trước đây (luôn loading rồi mới có data).
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
            // Trả dữ liệu cũ tức thì — bọc trong .then() để không phạm rule set-state-in-effect.
            Promise.resolve(cached).then((data) => {
                onSuccess(data);
            });
        }
        runFetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [depsKey]);

    // Gọi lại thủ công (nút "Làm mới", sau khi Create/Update/Delete) — bật lại isLoading ngay vì đây
    // là setState trong event handler, không phải trong effect nên không bị rule chặn.
    const refetch = () => {
        setIsLoading(true);
        setError(null);
        return runFetch();
    };

    return { isLoading, error, refetch };
}

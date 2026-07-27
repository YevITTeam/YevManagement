"use client";

import { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/apiError";

// Pattern chuẩn để fetch dữ liệu trong list/detail/panel — xem CLAUDE.md "Pattern fetch dữ liệu".
// Lý do cần hook này thay vì viết `fetchXxx` async/await gọi thẳng trong `useEffect` (cách cũ): rule
// `react-hooks/set-state-in-effect` (React Compiler) chỉ cho phép effect gọi hàm setState bên trong
// `.then()/.catch()/.finally()`, không cho phép gọi `async function` (kể cả khi setState nằm sau
// `await`). Hook tự bật lại `isLoading`/xoá `error` mỗi khi `deps` đổi bằng cách so sánh "snapshot"
// NGAY TRONG RENDER — cách React chính thức khuyến khích thay effect để "phản ứng" theo state khác
// (xem https://react.dev/learn/you-might-not-need-an-effect) — rồi effect chỉ còn việc gọi `fetcher`
// (một promise chain thuần, không async/await) để đổ dữ liệu.
export function useFetchEffect<T>(
    fetcher: () => Promise<T>,
    deps: readonly unknown[],
    onSuccess: (data: T) => void,
    errorFallback: string,
    onError?: (message: string) => void
) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const depsKey = JSON.stringify(deps);
    const [snapshot, setSnapshot] = useState(depsKey);
    if (snapshot !== depsKey) {
        setSnapshot(depsKey);
        setIsLoading(true);
        setError(null);
    }

    const runFetch = () => {
        return fetcher()
            .then((data) => {
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

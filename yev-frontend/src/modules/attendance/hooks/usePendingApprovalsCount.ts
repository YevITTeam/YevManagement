"use client";

import { useEffect, useState } from "react";
import { OtFormApi } from "@/modules/attendance/api/ot-form.api";

const POLL_INTERVAL_MS = 60_000;

// Only fetch when enabled (user has OTForm.Approve) to avoid useless calls for non-approver roles.
// setState stays inside .then()/.catch() to satisfy react-hooks/set-state-in-effect.
export function usePendingApprovalsCount(enabled: boolean) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;

        const fetchCount = () => {
            OtFormApi.getPendingApprovalsCount()
                .then((value) => {
                    if (!cancelled) setCount(value);
                })
                .catch(() => undefined);
        };

        fetchCount();
        const timer = setInterval(fetchCount, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [enabled]);

    return count;
}

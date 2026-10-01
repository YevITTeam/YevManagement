"use client";

import { useEffect, useState } from "react";
import { OtFormApi } from "@/modules/attendance/api/ot-form.api";

const POLL_INTERVAL_MS = 60_000;

// Badge sidebar "Đơn tăng ca" — số đơn đang chờ CHÍNH user gọi duyệt (2026-08-19). Chỉ gọi khi
// enabled=true (user có quyền Attendance.OTForm.Approve) — tránh gọi API thừa cho Role không duyệt.
// setState chỉ xảy ra trong .then()/.catch() của fetchCount, không đồng bộ trong thân effect
// (react-hooks/set-state-in-effect, xem AGENTS.md §4.5).
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

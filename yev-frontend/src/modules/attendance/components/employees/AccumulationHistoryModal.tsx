"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { EmployeeAccumulationHistoryYearDto } from "@/modules/attendance/types/employee-accumulation-history.dto";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import AccumulationHistoryTable from "./AccumulationHistoryTable";

interface AccumulationHistoryModalProps {
    employeeId: number;
    employeeLabel: string;
    onClose: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();
// Ledger chỉ ghi dần từ 2026-08-11d (không backfill) — cho chọn lùi vài năm là đủ, xa hơn chắc chắn rỗng.
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

// Modal tra lịch sử lũy kế 1 Employee — dùng chung ở EmployeeList.tsx (Admin) và OtFormDetail.tsx
// (người duyệt), mở qua nút "Xem lịch sử lũy kế" (2026-08-11d).
export default function AccumulationHistoryModal({ employeeId, employeeLabel, onClose }: AccumulationHistoryModalProps) {
    const t = useTranslations("Attendance.AccumulationHistory");
    const tCommon = useTranslations("Common");
    const { setting } = useAttendanceSetting();
    const [year, setYear] = useState(CURRENT_YEAR);
    const [data, setData] = useState<EmployeeAccumulationHistoryYearDto | null>(null);

    const { isLoading, error } = useFetchEffect(
        () => EmployeeApi.getAccumulationHistory(employeeId, year),
        [employeeId, year],
        (result) => setData(result),
        t("loadError"),
        (message) => toast.error(message)
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="accumulation-history-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-start justify-between">
                    <div>
                        <h2 id="accumulation-history-title" className="text-lg font-semibold text-[#191c1e]">
                            {t("modalTitle")}
                        </h2>
                        <p className="text-sm text-[#5e3f3a]">{employeeLabel}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={tCommon("close")}
                        title={tCommon("close")}
                        className="cursor-pointer rounded-lg p-1 text-[#8a8f94] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <label className="mb-4 block max-w-[140px]">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("fieldYear")}</span>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    >
                        {YEAR_OPTIONS.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </label>

                {isLoading ? (
                    <div className="py-8 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>
                ) : error ? (
                    <div className="py-8 text-center text-sm text-[#930006]">{error}</div>
                ) : data ? (
                    <AccumulationHistoryTable data={data} setting={setting} />
                ) : null}
            </div>
        </div>
    );
}

"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

import type { EmployeeAccumulationHistoryYearDto } from "@/modules/attendance/types/employee-accumulation-history.dto";
import type { AttendanceSettingDto } from "@/modules/attendance/types/attendance-setting.dto";

interface AccumulationHistoryTableProps {
    data: EmployeeAccumulationHistoryYearDto;
    setting: AttendanceSettingDto;
    onSelectMonth: (month: number) => void;
}

const badgeClass = (overLimit: boolean) =>
    `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        overLimit ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]" : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
    }`;

// Lũy kế THẬT của 1 năm, dạng lưới 12 ô (4 cột × 3 hàng) cho gọn — dùng trong AccumulationHistoryModal.
// Ngưỡng cảnh báo tái dùng đúng AttendanceSetting.monthlyOtHourLimit/yearlyOtHourLimit (2026-08-11d, xem
// docs/docs-be/attendance-module.md §Lịch sử lũy kế).
export default function AccumulationHistoryTable({ data, setting, onSelectMonth }: AccumulationHistoryTableProps) {
    const t = useTranslations("Attendance.AccumulationHistory");
    const isYearOverLimit = data.yearTotalHours > setting.yearlyOtHourLimit;
    const hasInitialBalance = data.initialBalanceHours !== undefined && data.initialBalanceHours !== 0;

    return (
        <div className="space-y-3">
            <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#191c1e]">{t("yearTotalLabel", { year: data.year })}</span>
                    <span className={badgeClass(isYearOverLimit)}>
                        {isYearOverLimit && <AlertTriangle className="h-3 w-3" />}
                        {data.yearTotalHours}h
                    </span>
                </div>
                {hasInitialBalance && (
                    <div className="mt-1 flex items-center justify-between text-xs text-[#5e3f3a]">
                        <span>{t("initialBalanceLabel")}</span>
                        <span className="font-semibold">{data.initialBalanceHours}h</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-4 gap-2">
                {data.months.map((month) => {
                    const isOverLimit = month.totalHours > setting.monthlyOtHourLimit;
                    return (
                        <button
                            type="button"
                            key={month.month}
                            onClick={() => onSelectMonth(month.month)}
                            className={`cursor-pointer rounded-lg border px-2 py-1.5 text-center transition hover:border-[#e3000f] ${
                                isOverLimit ? "border-[#e9bcb6] bg-[#fff4f2]" : "border-[#e0e3e5] bg-white"
                            }`}
                        >
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8f94]">
                                {t("monthShort", { month: month.month })}
                            </div>
                            <div
                                className={`flex items-center justify-center gap-1 text-sm font-semibold ${
                                    isOverLimit ? "text-[#930006]" : month.totalHours === 0 ? "text-[#b0b5ba]" : "text-[#191c1e]"
                                }`}
                            >
                                {isOverLimit && <AlertTriangle className="h-3 w-3" />}
                                {month.totalHours}h
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

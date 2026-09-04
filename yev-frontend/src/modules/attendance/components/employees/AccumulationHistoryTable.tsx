"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

import type { EmployeeAccumulationHistoryYearDto } from "@/modules/attendance/types/employee-accumulation-history.dto";
import type { AttendanceSettingDto } from "@/modules/attendance/types/attendance-setting.dto";

interface AccumulationHistoryTableProps {
    data: EmployeeAccumulationHistoryYearDto;
    setting: AttendanceSettingDto;
}

const badgeClass = (overLimit: boolean) =>
    `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        overLimit ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]" : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
    }`;

// Bảng 12 tháng lũy kế THẬT của 1 năm — dùng chung cho AccumulationHistoryModal (Admin ở EmployeeList,
// người duyệt ở OtFormDetail) và AccumulationLookupPage (màn "Lũy kế nhân viên"). Ngưỡng cảnh báo tái
// dùng đúng AttendanceSetting.monthlyOtHourLimit/yearlyOtHourLimit, cùng công thức badge đỏ đã có ở
// EmployeeList.tsx (2026-08-11d, xem docs/docs-be/attendance-module.md §Lịch sử lũy kế).
export default function AccumulationHistoryTable({ data, setting }: AccumulationHistoryTableProps) {
    const t = useTranslations("Attendance.AccumulationHistory");
    const isYearOverLimit = data.yearTotalHours > setting.yearlyOtHourLimit;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-2.5">
                <span className="text-sm font-semibold text-[#191c1e]">{t("yearTotalLabel", { year: data.year })}</span>
                <span className={badgeClass(isYearOverLimit)}>
                    {isYearOverLimit && <AlertTriangle className="h-3 w-3" />}
                    {data.yearTotalHours}h
                </span>
            </div>
            <table className="min-w-full border-collapse text-left">
                <thead>
                    <tr className="border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                        <th className="px-4 py-2">{t("colMonth")}</th>
                        <th className="px-4 py-2">{t("colTotalHours")}</th>
                    </tr>
                </thead>
                <tbody>
                    {data.initialBalanceHours !== undefined && data.initialBalanceHours !== 0 && (
                        <tr className="border-b border-[#e0e3e5] bg-[#f8fafc]/60 font-medium">
                            <td className="px-4 py-2 text-sm text-[#191c1e]">{t("initialBalanceLabel")}</td>
                            <td className="px-4 py-2 text-sm">
                                <span className={badgeClass(false)}>
                                    {data.initialBalanceHours}h
                                </span>
                            </td>
                        </tr>
                    )}
                    {data.months.map((month) => {
                        const isOverLimit = month.totalHours > setting.monthlyOtHourLimit;
                        return (
                            <tr key={month.month} className="border-b border-[#f1f5f9]">
                                <td className="px-4 py-2 text-sm text-[#5e3f3a]">{t("monthLabel", { month: month.month })}</td>
                                <td className="px-4 py-2 text-sm">
                                    <span className={badgeClass(isOverLimit)}>
                                        {isOverLimit && <AlertTriangle className="h-3 w-3" />}
                                        {month.totalHours}h
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

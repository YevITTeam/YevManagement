"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

import type { EmployeeAccumulationHistoryYearDto } from "@/modules/attendance/types/employee-accumulation-history.dto";

interface AccumulationHistoryTableProps {
    data: EmployeeAccumulationHistoryYearDto;
    // The person's effective limits (custom limit, else the system default).
    monthlyLimit: number;
    yearlyLimit: number;
    onSelectMonth: (month: number) => void;
}

export default function AccumulationHistoryTable({ data, monthlyLimit, yearlyLimit, onSelectMonth }: AccumulationHistoryTableProps) {
    const t = useTranslations("Attendance.AccumulationHistory");
    const tEmployee = useTranslations("Attendance.Employee");
    const isYearOverLimit = data.yearTotalHours > yearlyLimit;
    const hasInitialBalance = data.initialBalanceHours !== undefined && data.initialBalanceHours !== 0;

    return (
        <div className="space-y-3">
            <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#191c1e]">{t("yearTotalLabel")}</span>
                    <span
                        className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${isYearOverLimit ? "text-[#930006]" : "text-[#191c1e]"}`}
                        title={isYearOverLimit ? tEmployee("overLimitTitle", { limit: yearlyLimit }) : undefined}
                    >
                        {isYearOverLimit && <AlertTriangle className="h-3.5 w-3.5" />}
                        {data.yearTotalHours}h
                    </span>
                </div>
                {hasInitialBalance && (
                    <div className="mt-1 flex items-center justify-between text-xs text-[#5e3f3a]">
                        <span title={t("initialBalanceHint")}>{t("initialBalanceLabel")}</span>
                        <span className="font-semibold tabular-nums">{data.initialBalanceHours}h</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-4 gap-2">
                {data.months.map((month) => {
                    const isOverLimit = month.totalHours > monthlyLimit;
                    return (
                        <button
                            type="button"
                            key={month.month}
                            onClick={() => onSelectMonth(month.month)}
                            title={isOverLimit ? tEmployee("overLimitTitle", { limit: monthlyLimit }) : t("viewDays")}
                            className={`cursor-pointer rounded-lg border px-2 py-1.5 text-center transition hover:border-[#e3000f] ${
                                isOverLimit ? "border-[#e9bcb6] bg-[#fff4f2]" : "border-[#e0e3e5] bg-white"
                            }`}
                        >
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8f94]">
                                {t("monthShort", { month: month.month })}
                            </div>
                            <div
                                className={`flex items-center justify-center gap-1 text-sm font-semibold tabular-nums ${
                                    isOverLimit ? "text-[#930006]" : month.totalHours === 0 ? "text-[#8a8f94]" : "text-[#191c1e]"
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

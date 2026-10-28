"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";

import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { EmployeeAccumulationDayDto } from "@/modules/attendance/types/employee-accumulation-history.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface AccumulationDaysViewProps {
    employeeId: number;
    year: number;
    month: number;
    monthTotalHours: number;
    canEdit: boolean;
    onBack: () => void;
}

// Daily OT hours of one month as a Monday-first calendar, opened from a month cell of AccumulationHistoryTable.
export default function AccumulationDaysView({ employeeId, year, month, monthTotalHours, canEdit, onBack }: AccumulationDaysViewProps) {
    const t = useTranslations("Attendance.AccumulationHistory");
    const tCommon = useTranslations("Common");
    const [days, setDays] = useState<EmployeeAccumulationDayDto[]>([]);

    const { isLoading, error } = useFetchEffect(
        () => EmployeeApi.getAccumulationDays(employeeId, year, month, canEdit),
        [employeeId, year, month, canEdit],
        (result) => setDays(result),
        t("daysError"),
        (message) => toast.error(message)
    );

    const hoursByDay = new Map(days.map((d) => [Number(d.date.slice(8, 10)), d.hours]));
    const daysInMonth = new Date(year, month, 0).getDate();
    const leadingBlanks = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const dailyTotal = days.reduce((sum, d) => sum + d.hours, 0);
    const otherHours = Math.round((monthTotalHours - dailyTotal) * 100) / 100;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {t("daysBack")}
                </button>
                <span className="text-sm font-semibold text-[#191c1e]">{t("daysTitle", { month, year })}</span>
            </div>

            {isLoading ? (
                <div className="py-8 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>
            ) : error ? (
                <div className="py-8 text-center text-sm text-[#930006]">{error}</div>
            ) : (
                <>
                    <div className="grid grid-cols-7 gap-1.5">
                        {t("weekdays")
                            .split("|")
                            .map((label) => (
                                <div key={label} className="text-center text-[11px] font-semibold uppercase tracking-wide text-[#8a8f94]">
                                    {label}
                                </div>
                            ))}
                        {Array.from({ length: leadingBlanks }, (_, i) => (
                            <div key={`blank-${i}`} />
                        ))}
                        {Array.from({ length: daysInMonth }, (_, i) => {
                            const day = i + 1;
                            const hours = hoursByDay.get(day) ?? 0;
                            return (
                                <div key={day} className="rounded-lg border border-[#e0e3e5] bg-white px-1 py-1 text-center">
                                    <div className="text-[11px] text-[#8a8f94]">{day}</div>
                                    <div className={`text-sm font-semibold ${hours === 0 ? "text-[#b0b5ba]" : "text-[#191c1e]"}`}>{hours}h</div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-2.5 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#191c1e]">{t("daysTotal")}</span>
                            <span className="font-semibold text-[#191c1e]">{monthTotalHours}h</span>
                        </div>
                        {otherHours !== 0 && (
                            <div className="mt-1 flex items-center justify-between text-xs text-[#5e3f3a]">
                                <span>{t("daysOther")}</span>
                                <span className="font-semibold">{otherHours}h</span>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

"use client";

import { useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// docs/attendance-api-fe.md §3.6 — mọi user đăng nhập (kể cả không có Role nghiệp vụ) đều gọi được,
// chỉ hoạt động nếu Admin đã gán Employee.userName = username AD của họ.
export default function EmployeeAccumulationPanel() {
    const t = useTranslations("Attendance.EmployeeAccumulation");
    const tCommon = useTranslations("Common");
    const [employee, setEmployee] = useState<EmployeeDto | null>(null);
    const [notLinked, setNotLinked] = useState(false);

    const [monthToDate, setMonthToDate] = useState(0);
    const [yearToDate, setYearToDate] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    const { isLoading, refetch: fetchMe } = useFetchEffect(
        () => EmployeeApi.getMe(),
        [],
        (data) => {
            setEmployee(data);
            setMonthToDate(data.monthToDate);
            setYearToDate(data.yearToDate);
        },
        t("notLinkedError"),
        () => setNotLinked(true)
    );

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!employee) return;
        if (monthToDate < 0 || yearToDate < 0) {
            toast.error(t("negativeError"));
            return;
        }
        setIsSaving(true);
        try {
            await EmployeeApi.adjustAccumulation(employee.id, { monthToDate, yearToDate });
            toast.success(t("updateSuccess"));
            await fetchMe();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("updateError")));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="py-16 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>;
    }

    if (notLinked || !employee) {
        return (
            <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">
                {t("notLinkedMessage")}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">{t("title")}</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">
                    {employee.code} — {employee.lastName} {employee.firstName} ({employee.groupNameVn})
                </p>
            </div>

            <div className="grid max-w-xl grid-cols-2 gap-4">
                {[
                    { label: t("fieldMonthToDate"), value: employee.monthToDate, overLimit: employee.monthToDate > 25 },
                    { label: t("fieldYearToDate"), value: employee.yearToDate, overLimit: employee.yearToDate > 300 },
                ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-[#5e3f3a]">{stat.label}</p>
                                <h2 className={`mt-1 text-2xl font-semibold ${stat.overLimit ? "text-[#930006]" : "text-[#191c1e]"}`}>
                                    {stat.value}h
                                </h2>
                            </div>
                            <div className={`rounded-md p-3 ${stat.overLimit ? "bg-[#fff4f2] text-[#e3000f]" : "bg-[#f8fafc] text-[#5e3f3a]"}`}>
                                {stat.overLimit ? <AlertTriangle size={20} /> : <Clock size={20} />}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <section className="max-w-xl space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <p className="text-xs text-[#5e3f3a]">
                    {t("reflectingMonth", { month: employee.accumulationMonth, year: employee.accumulationYear })}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldMonthToDate")}</span>
                            <input
                                type="number"
                                step="0.5"
                                min={0}
                                value={monthToDate}
                                onChange={(event) => setMonthToDate(Number(event.target.value))}
                                disabled={isSaving}
                                className={fieldClassName}
                            />
                        </label>
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldYearToDate")}</span>
                            <input
                                type="number"
                                step="0.5"
                                min={0}
                                value={yearToDate}
                                onChange={(event) => setYearToDate(Number(event.target.value))}
                                disabled={isSaving}
                                className={fieldClassName}
                            />
                        </label>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSaving ? t("saving") : t("saveButton")}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}

"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

interface EmployeeOtLimitDialogProps {
    employee: EmployeeDto | null;
    onClose: () => void;
    onSaved: () => void;
}

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// Sửa RIÊNG giới hạn OT/tháng/năm (2026-08-29) — permission hẹp Attendance.Employee.UpdateOtLimit,
// dùng cho Người phụ trách Bộ phận (không có Attendance.Employee.Update nên không mở được EmployeeForm
// chung) — xem docs/attendance-module.md §API §Phân quyền theo Phòng ban.
export default function EmployeeOtLimitDialog({ employee, onClose, onSaved }: EmployeeOtLimitDialogProps) {
    const t = useTranslations("Attendance.Employee");
    const tCommon = useTranslations("Common");
    const { setting } = useAttendanceSetting();
    const [monthly, setMonthly] = useState<number | null>(null);
    const [yearly, setYearly] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useDialogReset(employee !== null, employee, (current) => {
        setMonthly(current?.customMonthlyOtHourLimit ?? null);
        setYearly(current?.customYearlyOtHourLimit ?? null);
    });

    if (!employee) return null;

    const handleClose = () => {
        if (isSaving) return;
        onClose();
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSaving(true);
        try {
            await EmployeeApi.updateOtLimit(employee.id, { customMonthlyOtHourLimit: monthly, customYearlyOtHourLimit: yearly });
            toast.success(t("otLimitSaveSuccess"));
            onSaved();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("otLimitSaveError")));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={handleClose} />
            <div role="dialog" aria-modal="true" className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 className="text-lg font-semibold text-[#191c1e]">
                        {t("otLimitDialogTitle")} — {employee.lastName} {employee.firstName} ({employee.code})
                    </h3>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldCustomMonthlyOtHourLimit")}</span>
                            <input
                                type="number"
                                step="1"
                                min={1}
                                value={monthly ?? ""}
                                onChange={(event) => setMonthly(event.target.value === "" ? null : Number(event.target.value))}
                                placeholder={String(setting.monthlyOtHourLimit)}
                                disabled={isSaving}
                                className={fieldClassName}
                            />
                        </label>
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldCustomYearlyOtHourLimit")}</span>
                            <input
                                type="number"
                                step="1"
                                min={1}
                                value={yearly ?? ""}
                                onChange={(event) => setYearly(event.target.value === "" ? null : Number(event.target.value))}
                                placeholder={String(setting.yearlyOtHourLimit)}
                                disabled={isSaving}
                                className={fieldClassName}
                            />
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSaving}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {tCommon("cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSaving ? t("saving") : t("updateSubmit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Pencil, X } from "lucide-react";

import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { EmployeeAccumulationHistoryYearDto } from "@/modules/attendance/types/employee-accumulation-history.dto";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { StyledSelect } from "@/components/ui/StyledSelect";
import AccumulationHistoryTable from "./AccumulationHistoryTable";
import AccumulationHistoryEditor from "./AccumulationHistoryEditor";
import AccumulationDaysView from "./AccumulationDaysView";

interface AccumulationHistoryModalProps {
    employeeId: number;
    employeeLabel: string;
    // With Attendance.EmployeeAccumulation.Update: read via the "manage" endpoint and show the edit button.
    canEdit?: boolean;
    onClose: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();
// The ledger was never backfilled, so older years are always empty.
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function AccumulationHistoryModal({ employeeId, employeeLabel, canEdit = false, onClose }: AccumulationHistoryModalProps) {
    const t = useTranslations("Attendance.AccumulationHistory");
    const tCommon = useTranslations("Common");
    const { setting } = useAttendanceSetting();
    const [year, setYear] = useState(CURRENT_YEAR);
    const [data, setData] = useState<EmployeeAccumulationHistoryYearDto | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

    const { isLoading, error } = useFetchEffect(
        () => (canEdit ? EmployeeApi.getAccumulationHistoryForManage(employeeId, year) : EmployeeApi.getAccumulationHistory(employeeId, year)),
        [employeeId, year, canEdit],
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
                className="z-60 mx-4 w-full max-h-[90vh] max-w-lg overflow-y-auto rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 id="accumulation-history-title" className="text-lg font-semibold text-[#191c1e]">
                            {t("modalTitle")}
                        </h2>
                        <p className="truncate text-sm text-[#5e3f3a]">{employeeLabel}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <StyledSelect
                            value={year}
                            onChange={(v) => {
                                setYear(v);
                                setIsEditing(false);
                                setSelectedMonth(null);
                            }}
                            ariaLabel={t("fieldYear")}
                            triggerClassName="h-9 rounded-lg border border-[#e0e3e5] bg-white px-2 pr-7 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                            options={YEAR_OPTIONS.map((y) => ({ value: y, label: String(y) }))}
                        />
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
                </div>

                {isLoading ? (
                    <div className="py-8 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>
                ) : error ? (
                    <div className="py-8 text-center text-sm text-[#930006]">{error}</div>
                ) : data ? (
                    isEditing ? (
                        <AccumulationHistoryEditor
                            key={`${data.employeeId}-${data.year}`}
                            data={data}
                            onSaved={(saved) => {
                                setData(saved);
                                setIsEditing(false);
                            }}
                            onCancel={() => setIsEditing(false)}
                        />
                    ) : selectedMonth !== null ? (
                        <AccumulationDaysView
                            employeeId={employeeId}
                            year={data.year}
                            month={selectedMonth}
                            monthTotalHours={data.months.find((m) => m.month === selectedMonth)?.totalHours ?? 0}
                            canEdit={canEdit}
                            onBack={() => setSelectedMonth(null)}
                        />
                    ) : (
                        <>
                            <AccumulationHistoryTable data={data} setting={setting} onSelectMonth={setSelectedMonth} />
                            {canEdit && (
                                <div className="mt-3 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(true)}
                                        className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        {t("edit")}
                                    </button>
                                </div>
                            )}
                        </>
                    )
                ) : null}
            </div>
        </div>
    );
}

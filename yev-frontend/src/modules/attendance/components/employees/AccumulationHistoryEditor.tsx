"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import { getApiErrorMessage } from "@/lib/apiError";
import type { EmployeeAccumulationHistoryYearDto } from "@/modules/attendance/types/employee-accumulation-history.dto";

interface AccumulationHistoryEditorProps {
    data: EmployeeAccumulationHistoryYearDto;
    onSaved: (data: EmployeeAccumulationHistoryYearDto) => void;
    onCancel: () => void;
}

const inputClass =
    "h-9 w-28 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

const monthInputClass =
    "h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-2 text-center text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

const round2 = (value: number) => Math.round(value * 100) / 100;

// Accepts a Vietnamese decimal comma; empty/invalid → null.
function parseHours(text: string): number | null {
    const normalized = text.trim().replace(",", ".");
    if (normalized === "") return null;
    const value = Number(normalized);
    return Number.isFinite(value) && value >= 0 ? value : null;
}

// Editing a month shifts the yearly total (opening balance unchanged); editing the yearly total sets
// opening balance = total − sum of 12 months, which must not go negative.
export default function AccumulationHistoryEditor({ data, onSaved, onCancel }: AccumulationHistoryEditorProps) {
    const t = useTranslations("Attendance.AccumulationHistory");
    const [monthTexts, setMonthTexts] = useState<string[]>(() => data.months.map((m) => String(m.totalHours)));
    const [initialBalance, setInitialBalance] = useState(data.initialBalanceHours ?? 0);
    const [yearText, setYearText] = useState(String(data.yearTotalHours));
    const [isSaving, setIsSaving] = useState(false);

    const monthValues = monthTexts.map(parseHours);
    const monthsValid = monthValues.every((v) => v !== null);
    const monthsSum = monthValues.reduce<number>((sum, v) => sum + (v ?? 0), 0);
    const yearValue = parseHours(yearText);
    const yearBelowMonths = yearValue !== null && round2(yearValue - monthsSum) < 0;
    const canSave = monthsValid && yearValue !== null && !yearBelowMonths && !isSaving;

    const handleMonthChange = (index: number, text: string) => {
        const next = monthTexts.map((old, i) => (i === index ? text : old));
        setMonthTexts(next);
        const sum = next.map(parseHours).reduce<number>((acc, v) => acc + (v ?? 0), 0);
        setYearText(String(round2(initialBalance + sum)));
    };

    const handleYearChange = (text: string) => {
        setYearText(text);
        const value = parseHours(text);
        if (value !== null) setInitialBalance(round2(value - monthsSum));
    };

    const handleSave = async () => {
        if (!canSave || yearValue === null) return;
        setIsSaving(true);
        try {
            const saved = await EmployeeApi.updateAccumulationHistory(data.employeeId, {
                year: data.year,
                initialBalanceHours: round2(yearValue - monthsSum),
                months: monthValues.map((v, i) => ({ month: i + 1, totalHours: round2(v ?? 0) })),
            });
            toast.success(t("saved"));
            onSaved(saved);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("saveError")));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-2.5">
                <span className="text-sm font-semibold text-[#191c1e]">{t("yearTotalEdit")}</span>
                <input
                    inputMode="decimal"
                    value={yearText}
                    onChange={(e) => handleYearChange(e.target.value)}
                    className={inputClass}
                    aria-label={t("yearTotalEdit")}
                />
            </div>
            {yearBelowMonths && <p className="text-xs text-[#930006]">{t("invalidYear")}</p>}
            {!monthsValid && <p className="text-xs text-[#930006]">{t("invalidNumber")}</p>}

            <div className="flex items-center justify-between px-1 text-xs text-[#5e3f3a]">
                <span>{t("initialDerived")}</span>
                <span className="font-semibold text-[#191c1e]">{round2(initialBalance)}h</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
                {monthTexts.map((text, index) => (
                    <label key={index} className="block">
                        <span className="mb-0.5 block text-center text-[11px] font-semibold uppercase tracking-wide text-[#8a8f94]">
                            {t("monthShort", { month: index + 1 })}
                        </span>
                        <input
                            inputMode="decimal"
                            value={text}
                            onChange={(e) => handleMonthChange(index, e.target.value)}
                            className={monthInputClass}
                            aria-label={t("monthLabel", { month: index + 1 })}
                        />
                    </label>
                ))}
            </div>

            <div className="flex justify-end gap-2 pt-1">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSaving}
                    className="h-10 cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                >
                    {t("cancel")}
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave}
                    className="h-10 cursor-pointer rounded-lg bg-[#e3000f] px-4 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSaving ? t("saving") : t("save")}
                </button>
            </div>
        </div>
    );
}

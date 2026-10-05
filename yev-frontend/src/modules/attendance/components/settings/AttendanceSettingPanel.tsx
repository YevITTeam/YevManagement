"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { CalendarDays, Download, Mail, Save, Send, Ticket, TrendingUp, Upload } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { AttendanceSettingApi } from "@/modules/attendance/api/attendance-setting.api";
import { OtFormBatchApi } from "@/modules/attendance/api/ot-form-batch.api";
import { WorkCalendarApi } from "@/modules/attendance/api/work-calendar.api";
import type { WorkCalendarDayDto } from "@/modules/attendance/types/work-calendar.dto";
import WorkCalendarDialog from "./WorkCalendarDialog";
import type { AttendanceSettingDto } from "@/modules/attendance/types/attendance-setting.dto";
import { invalidateAttendanceSettingCache } from "@/modules/attendance/hooks/useAttendanceSetting";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import TimePicker24h from "@/components/ui/TimePicker24h";

// BE sends TimeOnly as "HH:mm:ss"; TimePicker24h reads and writes "HH:mm". Trimmed and re-appended at
// the UI boundary so the DTO keeps its shape.
function toTimeInputValue(value: string): string {
    return value.slice(0, 5);
}
function fromTimeInputValue(value: string): string {
    return value.length === 5 ? `${value}:00` : value;
}

const fieldLabelClassName = "mb-1 block whitespace-nowrap text-[11px]! font-semibold! uppercase tracking-[0.06em] text-[#5e3f3a]";
const secondaryButtonClassName =
    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#e0e3e5] bg-white px-3 text-xs! font-semibold! text-[#191c1e] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50";
type NumberKey = "noMealTicketMaxHours" | "mainMealTicketMinHours" | "mealBreakDeductionHours" | "dailyOtHourLimit" | "monthlyOtHourLimit" | "yearlyOtHourLimit" | "dailyOtHourLimitHoliday";
type TimeKey = "earlyMealWindowStartTime" | "earlyMealWindowEndTime" | "batchAutoSendTime";
// Width is per-field, matched to the data it holds (DESIGN_SYSTEM.md §4.3) — never w-full in an
// even-split grid, which stretches a 1-digit value across the whole column.
const fieldClassName =
    "h-9 rounded-md border border-[#e0e3e5] bg-white px-2.5 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";
const numberFieldClassName = `${fieldClassName} w-20`;
const unitSuffixClassName = "text-xs text-[#8a8f94]";

// "Cấu hình" tab of the Danh mục screen. No permission check here: the whole tab already sits behind
// Attendance.Department.Create (Admin only), unlike the CRUD lists whose screens are open wider.
// Not a List (no table, no "Thêm mới") but implements ListHandle so CategoryManagement.tsx can drive
// the shared "Làm mới" button — openCreate() is a no-op.
const AttendanceSettingPanel = forwardRef<ListHandle, ListToolbarProps>(function AttendanceSettingPanel(
    { onLoadingChange },
    ref
) {
    const t = useTranslations("Attendance.AttendanceSetting");
    const [values, setValues] = useState<AttendanceSettingDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isRunningNow, setIsRunningNow] = useState(false);
    const [testEmail, setTestEmail] = useState("");
    const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

    const { isLoading, refetch: fetchSetting } = useFetchEffect(
        () => AttendanceSettingApi.getSetting(),
        [],
        (data) => setValues(data),
        t("loadError"),
        (message) => toast.error(message),
        "attendance-setting-panel"
    );

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    useImperativeHandle(ref, () => ({
        refresh: fetchSetting,
        openCreate: () => {},
    }));

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!values) return;
        if (
            values.mainMealTicketMinHours <= 0 ||
            values.noMealTicketMaxHours < 0 ||
            values.mealBreakDeductionHours < 0 ||
            values.noMealTicketMaxHours >= values.mainMealTicketMinHours ||
            values.dailyOtHourLimit <= 0 ||
            values.monthlyOtHourLimit <= 0 ||
            values.yearlyOtHourLimit <= 0 ||
            values.dailyOtHourLimitHoliday <= 0
        ) {
            toast.error(t("invalidValueError"));
            return;
        }
        setIsSaving(true);
        try {
            const updated = await AttendanceSettingApi.updateSetting(values);
            setValues(updated);
            // Drop the shared cache so every other screen picks up the new thresholds on its next
            // mount instead of needing a full page reload.
            invalidateAttendanceSettingCache();
            toast.success(t("updateSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("updateError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendTestEmail = async () => {
        const trimmed = testEmail.trim();
        if (!trimmed) {
            toast.error(t("testEmailRequiredError"));
            return;
        }
        setIsSendingTestEmail(true);
        try {
            await AttendanceSettingApi.sendTestEmail({ email: trimmed });
            toast.success(t("testEmailSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("testEmailError")));
        } finally {
            setIsSendingTestEmail(false);
        }
    };

    const handleRunNow = async () => {
        setIsRunningNow(true);
        try {
            await OtFormBatchApi.runNow();
            toast.success(t("runNowSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("runNowError")));
        } finally {
            setIsRunningNow(false);
        }
    };

    if (isLoading || !values) {
        return <div className="py-16 text-center text-sm text-[#5e3f3a]">{isLoading ? t("loading") : null}</div>;
    }

    const setNumber = (key: NumberKey) => (event: React.ChangeEvent<HTMLInputElement>) =>
        setValues((current) => current && { ...current, [key]: Number(event.target.value) });
    const setTime = (key: TimeKey) => (value: string) =>
        setValues((current) => current && { ...current, [key]: fromTimeInputValue(value) });

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-2">
                <SettingCard icon={<Ticket size={15} />} title={t("mealTicketSectionTitle")} desc={t("mealTicketSectionDesc")}>
                    <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
                        <Field label={t("fieldNoMealTicketMaxHours")} hint={t("fieldMainMealTicketMinHoursHint")}>
                            <HourInput step="0.5" min={0} max={24} value={values.noMealTicketMaxHours} onChange={setNumber("noMealTicketMaxHours")} disabled={isSaving} unit={t("unitHour")} />
                        </Field>
                        <Field label={t("fieldMainMealTicketMinHours")} hint={t("fieldMainMealTicketMinHoursHint")}>
                            <HourInput step="0.5" min={0.5} max={24} value={values.mainMealTicketMinHours} onChange={setNumber("mainMealTicketMinHours")} disabled={isSaving} unit={t("unitHour")} />
                        </Field>
                        <Field label={t("fieldMealBreakDeductionHours")}>
                            <HourInput step="0.25" min={0} max={4} value={values.mealBreakDeductionHours} onChange={setNumber("mealBreakDeductionHours")} disabled={isSaving} unit={t("unitHour")} />
                        </Field>
                        {/* One label over both bounds — two separate labels read as unrelated fields. */}
                        <div className="block">
                            <span className={`${fieldLabelClassName} cursor-help`} title={t("fieldEarlyMealWindowHint")}>
                                {t("fieldEarlyMealWindow")}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <TimePicker24h value={toTimeInputValue(values.earlyMealWindowStartTime)} onChange={setTime("earlyMealWindowStartTime")} disabled={isSaving} hourLabel={t("fieldEarlyMealWindowStartTime")} />
                                <span className={unitSuffixClassName}>&ndash;</span>
                                <TimePicker24h value={toTimeInputValue(values.earlyMealWindowEndTime)} onChange={setTime("earlyMealWindowEndTime")} disabled={isSaving} hourLabel={t("fieldEarlyMealWindowEndTime")} />
                            </div>
                        </div>
                    </div>
                </SettingCard>

                <SettingCard icon={<TrendingUp size={15} />} title={t("accumulationSectionTitle")} desc={t("accumulationSectionDesc")}>
                    <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
                        <Field label={t("fieldDailyOtHourLimit")} hint={t("accumulationHint")}>
                            <HourInput step="0.5" min={0.5} max={24} value={values.dailyOtHourLimit} onChange={setNumber("dailyOtHourLimit")} disabled={isSaving} unit={t("unitHour")} />
                        </Field>
                        <Field label={t("fieldDailyOtHourLimitHoliday")} hint={t("fieldDailyOtHourLimitHolidayHint")}>
                            <HourInput step="0.5" min={0.5} max={24} value={values.dailyOtHourLimitHoliday} onChange={setNumber("dailyOtHourLimitHoliday")} disabled={isSaving} unit={t("unitHour")} />
                        </Field>
                        <Field label={t("fieldMonthlyOtHourLimit")} hint={t("accumulationHint")}>
                            <HourInput step="1" min={1} value={values.monthlyOtHourLimit} onChange={setNumber("monthlyOtHourLimit")} disabled={isSaving} unit={t("unitHour")} />
                        </Field>
                        <Field label={t("fieldYearlyOtHourLimit")} hint={t("accumulationHint")}>
                            <HourInput step="1" min={1} value={values.yearlyOtHourLimit} onChange={setNumber("yearlyOtHourLimit")} disabled={isSaving} unit={t("unitHour")} />
                        </Field>
                    </div>
                </SettingCard>

                <WorkCalendarCard />

                <SettingCard icon={<Send size={15} />} title={t("batchSectionTitle")} desc={t("batchSectionDesc")}>
                    <div className="flex flex-wrap items-end gap-3">
                        <Field label={t("fieldBatchAutoSendTime")} hint={t("batchSectionHint")}>
                            <TimePicker24h value={toTimeInputValue(values.batchAutoSendTime)} onChange={setTime("batchAutoSendTime")} disabled={isSaving} />
                        </Field>
                        <button type="button" onClick={handleRunNow} disabled={isRunningNow} className={secondaryButtonClassName}>
                            <Send className="h-3.5 w-3.5" />
                            {isRunningNow ? t("runNowRunning") : t("runNowButton")}
                        </button>
                    </div>
                </SettingCard>

                <SettingCard icon={<Mail size={15} />} title={t("testEmailSectionTitle")} desc={t("testEmailSectionDesc")}>
                    <div className="flex flex-wrap items-end gap-3">
                        {/* Free-text address — the one field here that legitimately takes the remaining width. */}
                        <Field label={t("fieldTestEmail")} className="min-w-0 flex-1">
                            <input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder={t("fieldTestEmailPlaceholder")} disabled={isSendingTestEmail} className={`${fieldClassName} w-full`} />
                        </Field>
                        <button type="button" onClick={handleSendTestEmail} disabled={isSendingTestEmail} className={secondaryButtonClassName}>
                            <Mail className="h-3.5 w-3.5" />
                            {isSendingTestEmail ? t("testEmailSending") : t("testEmailButton")}
                        </button>
                    </div>
                </SettingCard>
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-[#e3000f] px-4 text-xs! font-semibold! text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Save className="h-3.5 w-3.5" />
                    {isSaving ? t("saving") : t("saveButton")}
                </button>
            </div>
        </form>
    );
});

// Company non-working-day calendar: pick a year, download its Excel template, re-import to replace the
// whole year. Days in the calendar use the holiday daily limit and make the OT case TH2.
function WorkCalendarCard() {
    const t = useTranslations("Attendance.AttendanceSetting");
    const [year, setYear] = useState(() => new Date().getFullYear());
    const [days, setDays] = useState<WorkCalendarDayDto[]>([]);
    const [isBusy, setIsBusy] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);

    const { refetch } = useFetchEffect(
        () => WorkCalendarApi.getByYear(year),
        [year],
        setDays,
        t("calendarLoadError"),
        (message) => toast.error(message)
    );

    const handleDownload = async () => {
        setIsBusy(true);
        try {
            const { blob, fileName } = await WorkCalendarApi.downloadTemplate(year);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? `LichNghi_${year}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("calendarTemplateError")));
        } finally {
            setIsBusy(false);
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!window.confirm(t("calendarImportConfirm", { year }))) return;
        setIsBusy(true);
        try {
            const result = await WorkCalendarApi.importYear(year, file);
            toast.success(t("calendarImportSuccess", { count: result.importedCount, year: result.year }));
            refetch();
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("calendarImportError")));
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <SettingCard icon={<CalendarDays size={15} />} title={t("calendarSectionTitle")} desc={t("calendarSectionDesc")}>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
                <Field label={t("calendarYear")}>
                    <input
                        type="number"
                        min={2000}
                        max={2100}
                        value={year}
                        onChange={(event) => setYear(Number(event.target.value) || year)}
                        disabled={isBusy}
                        className={`${fieldClassName} w-24`}
                    />
                </Field>
                <button type="button" onClick={() => setIsViewOpen(true)} className={secondaryButtonClassName}>
                    <CalendarDays className="h-3.5 w-3.5" />
                    {t("calendarView")}
                </button>
                <button type="button" onClick={handleDownload} disabled={isBusy} className={secondaryButtonClassName}>
                    <Download className="h-3.5 w-3.5" />
                    {t("calendarDownloadTemplate")}
                </button>
                <label className={`${secondaryButtonClassName} ${isBusy ? "pointer-events-none opacity-50" : ""}`}>
                    <Upload className="h-3.5 w-3.5" />
                    {t("calendarImport")}
                    <input type="file" accept=".xlsx" className="hidden" onChange={handleImport} disabled={isBusy} />
                </label>
            </div>
            {isViewOpen && <WorkCalendarDialog year={year} days={days} onClose={() => setIsViewOpen(false)} />}
        </SettingCard>
    );
}

// `desc` explains the whole section; it rides the title as a tooltip instead of a permanent paragraph
// (DESIGN_SYSTEM.md §4.10). The dotted underline is the affordance telling the user to hover.
function SettingCard({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-[#f1f5f9] px-4 py-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#fff4f2] text-[#e3000f]">{icon}</span>
                <h2
                    className={`text-sm font-semibold text-[#191c1e] ${desc ? "cursor-help decoration-dotted underline-offset-4 hover:underline" : ""}`}
                    title={desc}
                >
                    {title}
                </h2>
            </header>
            <div className="px-4 py-3">{children}</div>
        </section>
    );
}

// Narrow number box plus a unit suffix, so labels do not have to spell the unit out.
function HourInput({
    value,
    onChange,
    disabled,
    unit,
    step,
    min,
    max,
}: {
    value: number;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    disabled: boolean;
    unit: string;
    step: string;
    min: number;
    max?: number;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <input type="number" step={step} min={min} max={max} value={value} onChange={onChange} disabled={disabled} className={numberFieldClassName} />
            <span className={unitSuffixClassName}>{unit}</span>
        </div>
    );
}

function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
    return (
        <label className={`block ${className}`}>
            <span className={`${fieldLabelClassName} ${hint ? "cursor-help" : ""}`} title={hint}>
                {label}
            </span>
            {children}
        </label>
    );
}

export default AttendanceSettingPanel;

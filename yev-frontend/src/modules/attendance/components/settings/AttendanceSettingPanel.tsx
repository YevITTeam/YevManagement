"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Mail, Save, Send, Ticket, TrendingUp } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { AttendanceSettingApi } from "@/modules/attendance/api/attendance-setting.api";
import { OtFormBatchApi } from "@/modules/attendance/api/ot-form-batch.api";
import type { AttendanceSettingDto } from "@/modules/attendance/types/attendance-setting.dto";
import { invalidateAttendanceSettingCache } from "@/modules/attendance/hooks/useAttendanceSetting";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

// TimeOnly BE trả "HH:mm:ss" — input type="time" chỉ nhận/trả "HH:mm". Cắt/ghép ở biên UI, không đổi
// shape DTO (giữ đúng "HH:mm:ss" khi gửi lại BE).
function toTimeInputValue(value: string): string {
    return value.slice(0, 5);
}
function fromTimeInputValue(value: string): string {
    return value.length === 5 ? `${value}:00` : value;
}

const fieldLabelClassName = "mb-1 block truncate text-[11px]! font-semibold! uppercase tracking-[0.06em] text-[#5e3f3a]";
const secondaryButtonClassName =
    "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#e0e3e5] bg-white px-3 text-xs! font-semibold! text-[#191c1e] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50";
type NumberKey = "noMealTicketMaxHours" | "mainMealTicketMinHours" | "mealBreakDeductionHours" | "dailyOtHourLimit" | "monthlyOtHourLimit" | "yearlyOtHourLimit";
type TimeKey = "earlyMealWindowStartTime" | "earlyMealWindowEndTime" | "batchAutoSendTime";
const fieldClassName =
    "h-8 w-full rounded-md border border-[#e0e3e5] bg-white px-2.5 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// Tab "Cấu hình" trong màn Danh mục (CLAUDE.md §2 luật 2 — đã chốt qua AskUserQuestion 2026-08-01):
// GET /api/AttendanceSetting mở cho mọi tài khoản đăng nhập, PUT chỉ Admin — nhưng cả tab "Danh mục"
// này vốn đã bị khoá sau permission Attendance.Department.Create (chỉ Admin), nên KHÔNG cần tự kiểm
// tra quyền lần nữa ở đây, khác các List CRUD khác vẫn tự ẩn nút theo quyền vì màn của chúng mở rộng
// hơn. Không theo khuôn List (không có bảng/không "Thêm mới") nhưng vẫn implement ListHandle để
// CategoryManagement.tsx dùng chung nút "Làm mới" ở header — openCreate() là no-op.
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
            values.yearlyOtHourLimit <= 0
        ) {
            toast.error(t("invalidValueError"));
            return;
        }
        setIsSaving(true);
        try {
            const updated = await AttendanceSettingApi.updateSetting(values);
            setValues(updated);
            // Xoá cache dùng chung để mọi màn khác (Tạo đơn, Chi tiết đơn, danh sách nhân viên...) đọc
            // được ngưỡng mới ngay lần mount tiếp theo, không phải đợi F5 cả trang.
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
    const setTime = (key: TimeKey) => (event: React.ChangeEvent<HTMLInputElement>) =>
        setValues((current) => current && { ...current, [key]: fromTimeInputValue(event.target.value) });

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-2">
                <SettingCard icon={<Ticket size={15} />} title={t("mealTicketSectionTitle")}>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                        <Field label={t("fieldNoMealTicketMaxHours")}>
                            <input type="number" step="0.5" min={0} max={24} value={values.noMealTicketMaxHours} onChange={setNumber("noMealTicketMaxHours")} disabled={isSaving} className={fieldClassName} />
                        </Field>
                        <Field label={t("fieldMainMealTicketMinHours")}>
                            <input type="number" step="0.5" min={0.5} max={24} value={values.mainMealTicketMinHours} onChange={setNumber("mainMealTicketMinHours")} disabled={isSaving} className={fieldClassName} />
                        </Field>
                        <Field label={t("fieldMealBreakDeductionHours")}>
                            <input type="number" step="0.25" min={0} max={4} value={values.mealBreakDeductionHours} onChange={setNumber("mealBreakDeductionHours")} disabled={isSaving} className={fieldClassName} />
                        </Field>
                        <div className="grid grid-cols-2 gap-x-2">
                            <Field label={t("fieldEarlyMealWindowStartTime")}>
                                <input type="time" value={toTimeInputValue(values.earlyMealWindowStartTime)} onChange={setTime("earlyMealWindowStartTime")} disabled={isSaving} className={fieldClassName} />
                            </Field>
                            <Field label={t("fieldEarlyMealWindowEndTime")}>
                                <input type="time" value={toTimeInputValue(values.earlyMealWindowEndTime)} onChange={setTime("earlyMealWindowEndTime")} disabled={isSaving} className={fieldClassName} />
                            </Field>
                        </div>
                    </div>
                </SettingCard>

                <SettingCard icon={<TrendingUp size={15} />} title={t("accumulationSectionTitle")}>
                    <div className="grid grid-cols-3 gap-x-3">
                        <Field label={t("fieldDailyOtHourLimit")}>
                            <input type="number" step="0.5" min={0.5} max={24} value={values.dailyOtHourLimit} onChange={setNumber("dailyOtHourLimit")} disabled={isSaving} className={fieldClassName} />
                        </Field>
                        <Field label={t("fieldMonthlyOtHourLimit")}>
                            <input type="number" step="1" min={1} value={values.monthlyOtHourLimit} onChange={setNumber("monthlyOtHourLimit")} disabled={isSaving} className={fieldClassName} />
                        </Field>
                        <Field label={t("fieldYearlyOtHourLimit")}>
                            <input type="number" step="1" min={1} value={values.yearlyOtHourLimit} onChange={setNumber("yearlyOtHourLimit")} disabled={isSaving} className={fieldClassName} />
                        </Field>
                    </div>
                </SettingCard>

                <SettingCard icon={<Send size={15} />} title={t("batchSectionTitle")}>
                    <div className="flex flex-wrap items-end gap-3">
                        <Field label={t("fieldBatchAutoSendTime")}>
                            <input type="time" value={toTimeInputValue(values.batchAutoSendTime)} onChange={setTime("batchAutoSendTime")} disabled={isSaving} className={`${fieldClassName} w-32`} />
                        </Field>
                        <button type="button" onClick={handleRunNow} disabled={isRunningNow} className={secondaryButtonClassName}>
                            <Send className="h-3.5 w-3.5" />
                            {isRunningNow ? t("runNowRunning") : t("runNowButton")}
                        </button>
                    </div>
                </SettingCard>

                <SettingCard icon={<Mail size={15} />} title={t("testEmailSectionTitle")}>
                    <div className="flex flex-wrap items-end gap-3">
                        <Field label={t("fieldTestEmail")} className="min-w-0 flex-1">
                            <input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder={t("fieldTestEmailPlaceholder")} disabled={isSendingTestEmail} className={fieldClassName} />
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
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-[#e3000f] px-4 text-xs! font-semibold! text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Save className="h-3.5 w-3.5" />
                    {isSaving ? t("saving") : t("saveButton")}
                </button>
            </div>
        </form>
    );
});

function SettingCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-[#f1f5f9] px-4 py-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#fff4f2] text-[#e3000f]">{icon}</span>
                <h2 className="text-sm font-semibold text-[#191c1e]">{title}</h2>
            </header>
            <div className="px-4 py-3">{children}</div>
        </section>
    );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
    return (
        <label className={`block ${className}`}>
            <span className={fieldLabelClassName} title={label}>
                {label}
            </span>
            {children}
        </label>
    );
}

export default AttendanceSettingPanel;

"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Send, Ticket, TrendingUp } from "lucide-react";
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

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

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

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="rounded-md bg-[#fff4f2] p-2 text-[#e3000f]">
                        <Ticket size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-[#191c1e]">{t("mealTicketSectionTitle")}</h2>
                        <p className="text-xs text-[#5e3f3a]">{t("mealTicketSectionDesc")}</p>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldNoMealTicketMaxHours")}</span>
                        <input
                            type="number"
                            step="0.5"
                            min={0}
                            max={24}
                            value={values.noMealTicketMaxHours}
                            onChange={(event) => setValues((current) => current && { ...current, noMealTicketMaxHours: Number(event.target.value) })}
                            disabled={isSaving}
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldMainMealTicketMinHours")}</span>
                        <input
                            type="number"
                            step="0.5"
                            min={0.5}
                            max={24}
                            value={values.mainMealTicketMinHours}
                            onChange={(event) => setValues((current) => current && { ...current, mainMealTicketMinHours: Number(event.target.value) })}
                            disabled={isSaving}
                            className={fieldClassName}
                        />
                    </label>
                </div>
                <p className="text-xs text-[#5e3f3a]">{t("fieldMainMealTicketMinHoursHint")}</p>

                <div className="grid gap-4 sm:grid-cols-3">
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldMealBreakDeductionHours")}</span>
                        <input
                            type="number"
                            step="0.25"
                            min={0}
                            max={4}
                            value={values.mealBreakDeductionHours}
                            onChange={(event) => setValues((current) => current && { ...current, mealBreakDeductionHours: Number(event.target.value) })}
                            disabled={isSaving}
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldEarlyMealWindowStartTime")}</span>
                        <input
                            type="time"
                            value={toTimeInputValue(values.earlyMealWindowStartTime)}
                            onChange={(event) =>
                                setValues((current) => current && { ...current, earlyMealWindowStartTime: fromTimeInputValue(event.target.value) })
                            }
                            disabled={isSaving}
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldEarlyMealWindowEndTime")}</span>
                        <input
                            type="time"
                            value={toTimeInputValue(values.earlyMealWindowEndTime)}
                            onChange={(event) =>
                                setValues((current) => current && { ...current, earlyMealWindowEndTime: fromTimeInputValue(event.target.value) })
                            }
                            disabled={isSaving}
                            className={fieldClassName}
                        />
                    </label>
                </div>
                <p className="text-xs text-[#5e3f3a]">{t("fieldEarlyMealWindowHint")}</p>
            </section>

            <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="rounded-md bg-[#fff4f2] p-2 text-[#e3000f]">
                        <Send size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-[#191c1e]">{t("batchSectionTitle")}</h2>
                        <p className="text-xs text-[#5e3f3a]">{t("batchSectionDesc")}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-end gap-4">
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldBatchAutoSendTime")}</span>
                        <input
                            type="time"
                            value={toTimeInputValue(values.batchAutoSendTime)}
                            onChange={(event) =>
                                setValues((current) => current && { ...current, batchAutoSendTime: fromTimeInputValue(event.target.value) })
                            }
                            disabled={isSaving}
                            className={`${fieldClassName} w-36`}
                        />
                    </label>
                    <button
                        type="button"
                        onClick={handleRunNow}
                        disabled={isRunningNow}
                        className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Send className="h-3.5 w-3.5" />
                        {isRunningNow ? t("runNowRunning") : t("runNowButton")}
                    </button>
                </div>
                <p className="text-xs text-[#5e3f3a]">{t("batchSectionHint")}</p>
            </section>

            <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="rounded-md bg-[#fff4f2] p-2 text-[#e3000f]">
                        <TrendingUp size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-[#191c1e]">{t("accumulationSectionTitle")}</h2>
                        <p className="text-xs text-[#5e3f3a]">{t("accumulationSectionDesc")}</p>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldMonthlyOtHourLimit")}</span>
                        <input
                            type="number"
                            step="1"
                            min={1}
                            value={values.monthlyOtHourLimit}
                            onChange={(event) => setValues((current) => current && { ...current, monthlyOtHourLimit: Number(event.target.value) })}
                            disabled={isSaving}
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldYearlyOtHourLimit")}</span>
                        <input
                            type="number"
                            step="1"
                            min={1}
                            value={values.yearlyOtHourLimit}
                            onChange={(event) => setValues((current) => current && { ...current, yearlyOtHourLimit: Number(event.target.value) })}
                            disabled={isSaving}
                            className={fieldClassName}
                        />
                    </label>
                </div>
                <p className="text-xs text-[#5e3f3a]">{t("accumulationHint")}</p>
            </section>

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
    );
});

export default AttendanceSettingPanel;

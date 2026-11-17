"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { WorkCalendarApi } from "@/modules/attendance/api/work-calendar.api";
import { WorkCalendarDayType, type WorkCalendarDayDto } from "@/modules/attendance/types/work-calendar.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import FormDialog from "@/components/common/FormDialog";
import { StyledSelect } from "@/components/ui/StyledSelect";
import WorkCalendarView from "./WorkCalendarView";

const WORKING_DAY = 0;
const fieldClassName =
    "h-9 rounded-md border border-[#e0e3e5] bg-white px-2.5 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

type EditingDay = { date: string; dayType: number; note: string };

// One workshop's 12-month calendar; clicking a day edits it. Closes on backdrop click, the X button, or Escape.
export default function WorkCalendarDialog({
    workshopId,
    workshopName,
    year,
    days,
    onChanged,
    onClose,
}: {
    workshopId: number;
    workshopName: string;
    year: number;
    days: WorkCalendarDayDto[];
    onChanged: () => void;
    onClose: () => void;
}) {
    const t = useTranslations("Attendance.AttendanceSetting");
    const [editing, setEditing] = useState<EditingDay | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // The day editor handles its own Escape.
        if (editing) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, editing]);

    const openDay = (date: string) => {
        const entry = days.find((day) => day.date === date);
        setEditing({ date, dayType: entry?.dayType ?? WORKING_DAY, note: entry?.note ?? "" });
    };

    const displayDate = (date: string) => date.split("-").reverse().join("/");

    const handleSave = async () => {
        if (!editing) return;
        setIsSaving(true);
        try {
            await WorkCalendarApi.saveDay({
                workshopId,
                date: editing.date,
                dayType: editing.dayType === WORKING_DAY ? null : (editing.dayType as WorkCalendarDayType),
                note: editing.dayType === WORKING_DAY ? null : editing.note.trim() || null,
            });
            toast.success(t("calendarSaveSuccess", { date: displayDate(editing.date) }));
            setEditing(null);
            onChanged();
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("calendarSaveError")));
        } finally {
            setIsSaving(false);
        }
    };

    const typeOptions = [
        { value: WORKING_DAY, label: t("calendarTypeWorkingDay") },
        { value: WorkCalendarDayType.Sunday, label: t("calendarTypeSunday") },
        { value: WorkCalendarDayType.PublicHoliday, label: t("calendarTypePublicHoliday") },
        { value: WorkCalendarDayType.SpecialHoliday, label: t("calendarTypeSpecialHoliday") },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="work-calendar-dialog-title"
                className="z-60 mx-4 flex max-h-[90vh] w-full max-w-6xl flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] px-6 py-4">
                    <h3 id="work-calendar-dialog-title" className="text-lg font-semibold text-[#191c1e]">
                        {t("calendarDialogTitle", { workshop: workshopName, year })}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={t("calendarClose")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto px-6 pb-6">
                    <WorkCalendarView year={year} days={days} onDayClick={openDay} />
                </div>
            </div>

            <FormDialog
                isOpen={editing !== null}
                title={editing ? displayDate(editing.date) : ""}
                onClose={() => setEditing(null)}
                onSubmit={handleSave}
                loading={isSaving}
                submitLabel={t("calendarSave")}
                cancelLabel={t("calendarCancel")}
            >
                {editing && (
                    <>
                        <StyledSelect
                            value={editing.dayType}
                            onChange={(dayType) => setEditing({ ...editing, dayType })}
                            options={typeOptions}
                            triggerClassName={`${fieldClassName} w-44 pr-8`}
                        />
                        <input
                            value={editing.note}
                            onChange={(event) => setEditing({ ...editing, note: event.target.value })}
                            placeholder={t("calendarNote")}
                            maxLength={255}
                            disabled={editing.dayType === WORKING_DAY}
                            className={`${fieldClassName} w-full`}
                        />
                    </>
                )}
            </FormDialog>
        </div>
    );
}

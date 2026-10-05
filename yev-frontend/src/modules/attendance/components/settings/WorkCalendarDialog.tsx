"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import type { WorkCalendarDayDto } from "@/modules/attendance/types/work-calendar.dto";
import WorkCalendarView from "./WorkCalendarView";

// Popup holding the read-only 12-month calendar. Closes on backdrop click, the X button, or Escape.
export default function WorkCalendarDialog({ year, days, onClose }: { year: number; days: WorkCalendarDayDto[]; onClose: () => void }) {
    const t = useTranslations("Attendance.AttendanceSetting");

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

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
                        {t("calendarDialogTitle", { year })}
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
                    <WorkCalendarView year={year} days={days} />
                </div>
            </div>
        </div>
    );
}

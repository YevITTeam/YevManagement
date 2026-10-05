"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

import { WorkCalendarDayType, type WorkCalendarDayDto } from "@/modules/attendance/types/work-calendar.dto";

const DAY_TYPE_CELL_CLASS: Record<WorkCalendarDayType, string> = {
    [WorkCalendarDayType.PublicHoliday]: "bg-[#bfdbfe] font-semibold text-[#1e3a8a]",
    [WorkCalendarDayType.SpecialHoliday]: "bg-[#fde68a] font-semibold text-[#78350f]",
    [WorkCalendarDayType.Sunday]: "font-semibold text-[#e3000f]",
};

const LEGEND_SWATCH_CLASS: Record<WorkCalendarDayType, string> = {
    [WorkCalendarDayType.PublicHoliday]: "bg-[#bfdbfe]",
    [WorkCalendarDayType.SpecialHoliday]: "bg-[#fde68a]",
    [WorkCalendarDayType.Sunday]: "bg-white ring-1 ring-[#e3000f]",
};

const LEGEND_ORDER = [WorkCalendarDayType.PublicHoliday, WorkCalendarDayType.SpecialHoliday, WorkCalendarDayType.Sunday] as const;

const pad = (value: number) => String(value).padStart(2, "0");
const toDateKey = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

// Read-only 12-month view of the company calendar. A day with a row is a non-working day; hovering a day
// shows its type and note.
export default function WorkCalendarView({ year, days }: { year: number; days: WorkCalendarDayDto[] }) {
    const t = useTranslations("Attendance.AttendanceSetting");
    const locale = useLocale();

    const dayByDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
    const counts = useMemo(() => {
        const result: Record<WorkCalendarDayType, number> = {
            [WorkCalendarDayType.Sunday]: 0,
            [WorkCalendarDayType.PublicHoliday]: 0,
            [WorkCalendarDayType.SpecialHoliday]: 0,
        };
        for (const day of days) result[day.dayType] += 1;
        return result;
    }, [days]);

    const dayTypeLabel: Record<WorkCalendarDayType, string> = {
        [WorkCalendarDayType.Sunday]: t("calendarTypeSunday"),
        [WorkCalendarDayType.PublicHoliday]: t("calendarTypePublicHoliday"),
        [WorkCalendarDayType.SpecialHoliday]: t("calendarTypeSpecialHoliday"),
    };

    // Sunday-first weekday headers in the active locale (2023-01-01 is a Sunday).
    const weekdayLabels = useMemo(() => {
        const formatter = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
        return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(Date.UTC(2023, 0, 1 + index))));
    }, [locale]);
    const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }), [locale]);

    const today = new Date();
    const todayKey = toDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());

    return (
        <div className="mt-3">
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#5e3f3a]">
                {LEGEND_ORDER.map((dayType) => (
                    <span key={dayType} className="inline-flex items-center gap-1.5">
                        <span className={`inline-block h-3 w-3 rounded-sm ${LEGEND_SWATCH_CLASS[dayType]}`} />
                        {dayTypeLabel[dayType]}: {counts[dayType]}
                    </span>
                ))}
            </div>

            {days.length === 0 && <p className="mb-3 text-xs text-[#5e3f3a]">{t("calendarEmpty", { year })}</p>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 12 }, (_, monthIndex) => {
                    const month = monthIndex + 1;
                    const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
                    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
                    const cells: (number | null)[] = [
                        ...Array.from({ length: firstWeekday }, () => null),
                        ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
                    ];

                    return (
                        <div key={month} className="rounded-lg border border-[#e0e3e5] bg-white p-2.5">
                            <h3 className="mb-1.5 text-xs font-semibold capitalize text-[#191c1e]">{monthFormatter.format(new Date(Date.UTC(year, monthIndex, 1)))}</h3>
                            <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
                                {weekdayLabels.map((label, index) => (
                                    <span key={label} className={`py-0.5 font-semibold ${index === 0 ? "text-[#e3000f]" : "text-[#8a8f94]"}`}>
                                        {label}
                                    </span>
                                ))}
                                {cells.map((day, index) => {
                                    if (day === null) return <span key={`blank-${index}`} />;
                                    const key = toDateKey(year, month, day);
                                    const entry = dayByDate.get(key);
                                    const title = entry ? `${dayTypeLabel[entry.dayType]}${entry.note ? ` — ${entry.note}` : ""}` : undefined;
                                    return (
                                        <span
                                            key={key}
                                            title={title}
                                            className={`rounded py-0.5 ${entry ? DAY_TYPE_CELL_CLASS[entry.dayType] : "text-[#191c1e]"} ${key === todayKey ? "ring-2 ring-[#e3000f]" : ""}`}
                                        >
                                            {day}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

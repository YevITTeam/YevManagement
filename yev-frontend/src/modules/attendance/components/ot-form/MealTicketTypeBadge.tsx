import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import type { OtFormEmployeeDto, ProcessPartDto } from "@/modules/attendance/types/ot-form.dto";
import { MEAL_TICKET_MAIN, MEAL_TICKET_SECONDARY } from "@/modules/attendance/lib/mealTicket";

// Read-only OT form cells shared by OtFormDetail, OtFormBatchDetail and the email confirm page.
// `t` accepts both useTranslations() and createBilingualTranslator() for the "Attendance.OtFormDetail" namespace.
type Translate = (key: string, values?: Record<string, string | number>) => string;

// CreateOtFormPage has its own preview logic and never passes "no ticket".
export function MealTicketTypeBadge({ type, t }: { type: number; t: (key: string) => string }) {
    if (type === MEAL_TICKET_MAIN) {
        return (
            <span className="inline-flex items-center whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {t("mealTicketTypeMain")}
            </span>
        );
    }
    if (type === MEAL_TICKET_SECONDARY) {
        return (
            <span className="inline-flex items-center whitespace-nowrap rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2 py-0.5 text-xs font-semibold text-[#5e3f3a]">
                {t("mealTicketTypeSecondary")}
            </span>
        );
    }
    return (
        <span role="img" aria-label={t("mealTicketTypeNone")} title={t("mealTicketTypeNone")} className="text-[#8a8f94]">
            –
        </span>
    );
}

export function ProcessPartTile({ icon, label, active, activeLabel, inactiveLabel }: {
    icon: ReactNode;
    label: string;
    active: boolean;
    activeLabel: string;
    inactiveLabel: string;
}) {
    return (
        <span
            title={active ? activeLabel : inactiveLabel}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${
                active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#e0e3e5] bg-white text-[#8a8f94] line-through"
            }`}
        >
            {icon}
            {label}
        </span>
    );
}

// Zero counts are noise on read-only screens; "" when nothing is left.
export function mealCountsText(processPart: ProcessPartDto | null, t: Translate): string {
    if (!processPart?.isEat) return "";
    const counts = [
        ["mainTicketLabel", processPart.mainTicketCount],
        ["secondaryTicketLabel", processPart.secondaryTicketCount],
        ["milkLabel", processPart.milkCount],
    ] as const;
    return counts
        .filter(([, count]) => count > 0)
        .map(([key, count]) => t(key, { count }))
        .join(" · ");
}

type LimitRow = Pick<OtFormEmployeeDto, "monthToDate" | "yearToDate" | "customMonthlyOtHourLimitSnapshot" | "customYearlyOtHourLimitSnapshot">;

// Same rule as formOverLimit (company or own limit), but returns the limit that was passed so the cell can name it.
export function exceededLimits(row: LimitRow, limits: { monthlyOtHourLimit: number; yearlyOtHourLimit: number }) {
    const pick = (hours: number, shared: number, own: number | null) =>
        own !== null && hours > own ? own : hours > shared ? shared : null;
    return {
        month: pick(row.monthToDate, limits.monthlyOtHourLimit, row.customMonthlyOtHourLimitSnapshot),
        year: pick(row.yearToDate, limits.yearlyOtHourLimit, row.customYearlyOtHourLimitSnapshot),
    };
}

// Red alone didn't tell approvers why; the icon + title name the limit.
export function AccumulationHours({ hours, overTitle }: { hours: number; overTitle?: string }) {
    if (!overTitle) return <span className="text-[#5e3f3a]">{hours}h</span>;
    return (
        <span title={overTitle} className="inline-flex items-center gap-1 font-semibold text-[#930006]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {hours}h
        </span>
    );
}

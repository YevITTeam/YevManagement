import { MEAL_TICKET_MAIN, MEAL_TICKET_SECONDARY } from "@/modules/attendance/lib/mealTicket";

// Badge "Loại phiếu ăn" dùng chung cho các màn CHỈ XEM đơn đã lưu (OtFormDetail/OtFormBatchDetail/
// OtFormEmailConfirmPage) — đọc thẳng OtFormEmployeeDto.mealTicketType do BE tính sẵn, khác
// CreateOtFormPage.tsx (có bản riêng tự tính preview lúc đơn chưa lưu). `t` nhận cả useTranslations()
// lẫn createBilingualTranslator() vì cùng namespace "Attendance.OtFormDetail".
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
    return <span className="whitespace-nowrap text-[#9aa0a6]">{t("mealTicketTypeNone")}</span>;
}

import type { AttendanceSettingDto } from "@/modules/attendance/types/attendance-setting.dto";

// Mirrors BE OtFormService.CalculateOtHours/CalculateMealTicketType for create-form preview only;
// BE stays the source of truth for saved forms.
export const MEAL_TICKET_NONE = 0;
export const MEAL_TICKET_SECONDARY = 1;
export const MEAL_TICKET_MAIN = 2;

function toMinutes(time: string): number {
    if (!time) return NaN;
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

// BE TimeOnly is "HH:mm:ss", form inputs are "HH:mm".
function normalizeTime(time: string): string {
    return time.length >= 5 ? time.slice(0, 5) : time;
}

function computeRawHours(startTime: string, endTime: string): number {
    if (!startTime || !endTime) return 0;
    const startMinutes = toMinutes(startTime);
    let endMinutes = toMinutes(endTime);
    if (endMinutes < startMinutes) endMinutes += 24 * 60;
    return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100;
}

// Exact match of the early window (not overlap): no meal-break deduction and always a secondary ticket.
export function isEarlyMealWindowOt(startTime: string, endTime: string, setting: AttendanceSettingDto): boolean {
    return (
        normalizeTime(startTime) === normalizeTime(setting.earlyMealWindowStartTime) &&
        normalizeTime(endTime) === normalizeTime(setting.earlyMealWindowEndTime)
    );
}

// Only employees who ate get the meal-break deduction (outside the early window).
export function computeActualHours(startTime: string, endTime: string, didEat: boolean, setting: AttendanceSettingDto): number {
    const raw = computeRawHours(startTime, endTime);
    if (isEarlyMealWindowOt(startTime, endTime, setting)) return raw;
    return didEat ? raw - setting.mealBreakDeductionHours : raw;
}

// Mirrors BE MealTicketCalculator.SplitHoursByDay: the meal break comes off the longer part, the start day on a tie.
export function splitHoursByDay(formStart: string, startTime: string, endTime: string, didEat: boolean, setting: AttendanceSettingDto) {
    const actual = computeActualHours(startTime, endTime, didEat, setting);
    if (toMinutes(endTime) >= toMinutes(startTime)) {
        return toMinutes(startTime) < toMinutes(formStart) ? { firstDay: 0, nextDay: actual } : { firstDay: actual, nextDay: 0 };
    }
    const raw = computeRawHours(startTime, endTime);
    const after = toMinutes(endTime) / 60;
    const before = raw - after;
    const deduction = raw - actual;
    return before >= after ? { firstDay: before - deduction, nextDay: after } : { firstDay: before, nextDay: after - deduction };
}

export function computeMealTicketType(startTime: string, endTime: string, didEat: boolean, setting: AttendanceSettingDto): number {
    if (isEarlyMealWindowOt(startTime, endTime, setting)) return MEAL_TICKET_SECONDARY;

    const actualHours = computeActualHours(startTime, endTime, didEat, setting);
    if (actualHours < setting.noMealTicketMaxHours) return MEAL_TICKET_NONE;
    if (actualHours < setting.mainMealTicketMinHours) return MEAL_TICKET_SECONDARY;
    return MEAL_TICKET_MAIN;
}

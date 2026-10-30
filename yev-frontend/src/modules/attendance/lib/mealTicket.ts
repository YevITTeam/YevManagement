import type { AttendanceSettingDto } from "@/modules/attendance/types/attendance-setting.dto";

// Redesign 3 bậc phiếu ăn (2026-08-26, chốt với người dùng — xem docs/attendance-module.md §Phiếu ăn).
// Mirror OtFormService.CalculateOtHours/CalculateMealTicketType bên BE — BE là nguồn chân lý cho đơn
// đã lưu (OtFormEmployeeDto.actualHours/mealTicketType), các hàm ở đây chỉ dùng để PREVIEW lúc đang
// tạo đơn (CreateOtFormPage.tsx), khi OtFormEmployee chưa tồn tại để BE tính.
export const MEAL_TICKET_NONE = 0;
export const MEAL_TICKET_SECONDARY = 1;
export const MEAL_TICKET_MAIN = 2;

function toMinutes(time: string): number {
    if (!time) return NaN;
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

// BE trả TimeOnly "HH:mm:ss", input giờ tạo đơn là "HH:mm" — cắt về chung "HH:mm" để so khớp.
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

// Ca OT khớp ĐÚNG khung sớm (mặc định 6h-8h, không phải chỉ overlap) — đặc cách không trừ giờ nghỉ ăn
// + luôn phiếu Phụ, bất kể DidEat/độ dài ca (chốt với người dùng 2026-08-26).
export function isEarlyMealWindowOt(startTime: string, endTime: string, setting: AttendanceSettingDto): boolean {
    return (
        normalizeTime(startTime) === normalizeTime(setting.earlyMealWindowStartTime) &&
        normalizeTime(endTime) === normalizeTime(setting.earlyMealWindowEndTime)
    );
}

// Giờ tính lũy kế/hiển thị: chỉ người có ăn mới bị trừ mealBreakDeductionHours (ngoài khung sớm).
export function computeActualHours(startTime: string, endTime: string, didEat: boolean, setting: AttendanceSettingDto): number {
    const raw = computeRawHours(startTime, endTime);
    if (isEarlyMealWindowOt(startTime, endTime, setting)) return raw;
    return didEat ? raw - setting.mealBreakDeductionHours : raw;
}

export function computeMealTicketType(startTime: string, endTime: string, didEat: boolean, setting: AttendanceSettingDto): number {
    if (isEarlyMealWindowOt(startTime, endTime, setting)) return MEAL_TICKET_SECONDARY;

    const actualHours = computeActualHours(startTime, endTime, didEat, setting);
    if (actualHours < setting.noMealTicketMaxHours) return MEAL_TICKET_NONE;
    if (actualHours < setting.mainMealTicketMinHours) return MEAL_TICKET_SECONDARY;
    return MEAL_TICKET_MAIN;
}

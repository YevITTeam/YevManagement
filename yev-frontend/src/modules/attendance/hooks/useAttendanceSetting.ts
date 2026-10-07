"use client";

import { useState } from "react";

import { AttendanceSettingApi } from "@/modules/attendance/api/attendance-setting.api";
import type { AttendanceSettingDto } from "@/modules/attendance/types/attendance-setting.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

// Giá trị dùng tạm trong lúc chờ API trả về (và khi API lỗi) — PHẢI khớp seed trong migration
// AddAttendanceSetting + các hằng Default* trong AttendanceSettingService bên BE, để UI không nhảy số
// giữa lúc tải xong và cũng không cảnh báo sai nếu mạng lỗi.
export const DEFAULT_ATTENDANCE_SETTING: AttendanceSettingDto = {
    mainMealTicketMinHours: 3.5,
    noMealTicketMaxHours: 2,
    mealBreakDeductionHours: 0.5,
    earlyMealWindowStartTime: "06:00:00",
    earlyMealWindowEndTime: "08:00:00",
    dailyOtHourLimit: 4,
    monthlyOtHourLimit: 25,
    yearlyOtHourLimit: 300,
    dailyOtHourLimitHoliday: 12,
    batchAutoSendTime: "15:00:00",
};

// Cấu hình này gần như không đổi nhưng lại cần ở RẤT nhiều màn (tạo đơn, chi tiết đơn, danh sách nhân
// viên, bản in, trang xác nhận qua email...). Cache ở tầng module để nhiều component cùng mount chỉ tốn
// đúng 1 request, thay vì mỗi component tự gọi lại — dự án không dùng React Query nên tự memo hoá
// promise là cách gọn nhất, đúng tinh thần "chỉ fetch wrapper thủ công" ở frontend-conventions.md.
let cachedSettingPromise: Promise<AttendanceSettingDto> | null = null;

function getCachedAttendanceSetting(): Promise<AttendanceSettingDto> {
    // Lỗi thì xoá cache để lần mount sau thử lại, không "dính" mãi 1 promise đã reject.
    cachedSettingPromise ??= AttendanceSettingApi.getSetting().catch((err) => {
        cachedSettingPromise = null;
        throw err;
    });
    return cachedSettingPromise;
}

// Gọi sau khi Admin lưu cấu hình mới, để các màn khác mở sau đó đọc được giá trị mới thay vì bản cache cũ.
export function invalidateAttendanceSettingCache() {
    cachedSettingPromise = null;
}

// Trả về cấu hình hiện hành; trong lúc tải (và nếu tải lỗi) trả DEFAULT_ATTENDANCE_SETTING. Cố tình
// KHÔNG toast lỗi — cấu hình chỉ ảnh hưởng gợi ý số phiếu + màu cảnh báo, không đáng để bắn toast đỏ
// trên mọi màn nếu mạng chập chờn.
export function useAttendanceSetting() {
    const [setting, setSetting] = useState<AttendanceSettingDto>(DEFAULT_ATTENDANCE_SETTING);

    const { isLoading } = useFetchEffect(
        () => getCachedAttendanceSetting(),
        [],
        (data) => setSetting(data),
        "Không thể tải cấu hình chấm công."
    );

    return { setting, isLoading };
}

"use client";

import { useState } from "react";

import { AttendanceSettingApi } from "@/modules/attendance/api/attendance-setting.api";
import type { AttendanceSettingDto } from "@/modules/attendance/types/attendance-setting.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

// Must match the AddAttendanceSetting seed and BE Default* constants so the UI doesn't jump or warn wrongly on load/error.
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
    resubmitWindowDays: 3,
    backdateDays: 7,
};

// Module-level promise cache: needed by many screens, so concurrent mounts share one request.
let cachedSettingPromise: Promise<AttendanceSettingDto> | null = null;

function getCachedAttendanceSetting(): Promise<AttendanceSettingDto> {
    // Drop the cache on error so the next mount retries instead of keeping a rejected promise.
    cachedSettingPromise ??= AttendanceSettingApi.getSetting().catch((err) => {
        cachedSettingPromise = null;
        throw err;
    });
    return cachedSettingPromise;
}

// Call after Admin saves so later screens don't read the stale cache.
export function invalidateAttendanceSettingCache() {
    cachedSettingPromise = null;
}

// Falls back to DEFAULT_ATTENDANCE_SETTING while loading/on error; no error toast on purpose since it
// only affects ticket suggestions and warning colors.
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

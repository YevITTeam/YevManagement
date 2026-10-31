import { api } from "@/lib/client";
import type { AttendanceSettingDto, SendTestEmailDto, UpdateAttendanceSettingDto } from "@/modules/attendance/types/attendance-setting.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    ATTENDANCE_SETTING: {
        get: "/AttendanceSetting",
        update: "/AttendanceSetting",
        testEmail: "/AttendanceSetting/test-email",
    },
} as const;

export const AttendanceSettingApi = {
    // Open to every signed-in user: the create-form screen needs it for meal vouchers and over-limit highlighting.
    getSetting: async () => {
        const response = await api.get<ApiResponse<AttendanceSettingDto>>(ENDPOINTS.ATTENDANCE_SETTING.get);
        return response.data;
    },
    // Requires Attendance.Setting.Update; BE enforces 403 even though FE hides the Save button.
    updateSetting: async (data: UpdateAttendanceSettingDto) => {
        const response = await api.put<ApiResponse<AttendanceSettingDto>>(ENDPOINTS.ATTENDANCE_SETTING.update, data);
        return response.data;
    },
    // BE returns false (does not throw) when SMTP sending fails.
    sendTestEmail: async (data: SendTestEmailDto) => {
        const response = await api.post<ApiResponse<boolean>>(ENDPOINTS.ATTENDANCE_SETTING.testEmail, data);
        return response.data;
    },
};

export { ENDPOINTS };

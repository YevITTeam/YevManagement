import { api } from "@/lib/client";
import type { AttendanceSettingDto, UpdateAttendanceSettingDto } from "@/modules/attendance/types/attendance-setting.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    ATTENDANCE_SETTING: {
        get: "/AttendanceSetting",
        update: "/AttendanceSetting",
    },
} as const;

export const AttendanceSettingApi = {
    // GET không cần permission (mọi tài khoản đăng nhập đều gọi được) — màn Tạo đơn cần cấu hình này
    // để tự tính phiếu ăn và tô đỏ lũy kế vượt ngưỡng, xem docs §6d.
    getSetting: async () => {
        const response = await api.get<ApiResponse<AttendanceSettingDto>>(ENDPOINTS.ATTENDANCE_SETTING.get);
        return response.data;
    },
    // PUT cần permission `Attendance.Setting.Update` (thực tế chỉ Admin) — FE ẩn nút Lưu nếu thiếu quyền,
    // BE vẫn enforce lại 403.
    updateSetting: async (data: UpdateAttendanceSettingDto) => {
        const response = await api.put<ApiResponse<AttendanceSettingDto>>(ENDPOINTS.ATTENDANCE_SETTING.update, data);
        return response.data;
    },
};

export { ENDPOINTS };

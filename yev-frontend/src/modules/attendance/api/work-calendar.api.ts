import { api, getForBlob } from "@/lib/client";
import type { WorkCalendarDayDto, WorkCalendarImportResultDto } from "@/modules/attendance/types/work-calendar.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    WORK_CALENDAR: {
        list: "/WorkCalendar",
        template: "/WorkCalendar/template",
        import: "/WorkCalendar/import",
    },
} as const;

export const WorkCalendarApi = {
    // GET mở cho mọi tài khoản đăng nhập — màn Tạo đơn cần lịch để tự chọn TH1/TH2.
    getByYear: async (year: number) => {
        const response = await api.get<ApiResponse<WorkCalendarDayDto[]>>(`${ENDPOINTS.WORK_CALENDAR.list}?year=${year}`);
        return response.data;
    },
    // File mẫu của 1 năm: đủ các Chủ nhật + các ngày đã lưu của năm đó.
    downloadTemplate: (year: number) => getForBlob(`${ENDPOINTS.WORK_CALENDAR.template}?year=${year}`),
    // multipart/form-data — field "file". Thay thế TOÀN BỘ lịch của năm; cần quyền Attendance.Setting.Update.
    importYear: async (year: number, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.postForm<ApiResponse<WorkCalendarImportResultDto>>(`${ENDPOINTS.WORK_CALENDAR.import}?year=${year}`, formData);
        return response.data;
    },
};

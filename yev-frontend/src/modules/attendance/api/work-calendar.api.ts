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
    // Open to every signed-in user: the create-form screen needs it to pick TH1/TH2.
    getByYear: async (year: number) => {
        const response = await api.get<ApiResponse<WorkCalendarDayDto[]>>(`${ENDPOINTS.WORK_CALENDAR.list}?year=${year}`);
        return response.data;
    },
    // Template contains every Sunday plus the saved days of that year.
    downloadTemplate: (year: number) => getForBlob(`${ENDPOINTS.WORK_CALENDAR.template}?year=${year}`),
    // Replaces the WHOLE year's calendar; requires Attendance.Setting.Update.
    importYear: async (year: number, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.postForm<ApiResponse<WorkCalendarImportResultDto>>(`${ENDPOINTS.WORK_CALENDAR.import}?year=${year}`, formData);
        return response.data;
    },
};

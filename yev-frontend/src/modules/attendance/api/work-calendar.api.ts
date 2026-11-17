import { api, getForBlob } from "@/lib/client";
import type { SaveWorkCalendarDayDto, WorkCalendarDayDto, WorkCalendarImportResultDto } from "@/modules/attendance/types/work-calendar.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    WORK_CALENDAR: {
        list: "/WorkCalendar",
        template: "/WorkCalendar/template",
        import: "/WorkCalendar/import",
        day: "/WorkCalendar/day",
    },
} as const;

// Each workshop has its own calendar.
export const WorkCalendarApi = {
    // Open to every signed-in user: the create-form screen needs it to pick TH1/TH2.
    getByYear: async (workshopId: number, year: number) => {
        const response = await api.get<ApiResponse<WorkCalendarDayDto[]>>(`${ENDPOINTS.WORK_CALENDAR.list}?workshopId=${workshopId}&year=${year}`);
        return response.data;
    },
    getByYearForWorkshopCode: async (workshopCode: string, year: number) => {
        const response = await api.get<ApiResponse<WorkCalendarDayDto[]>>(`${ENDPOINTS.WORK_CALENDAR.list}?workshopCode=${encodeURIComponent(workshopCode)}&year=${year}`);
        return response.data;
    },
    // Template contains every Sunday plus the saved days of that year.
    downloadTemplate: (workshopId: number, year: number) => getForBlob(`${ENDPOINTS.WORK_CALENDAR.template}?workshopId=${workshopId}&year=${year}`),
    // Replaces the WHOLE year of that workshop; requires Attendance.Setting.Update.
    importYear: async (workshopId: number, year: number, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.postForm<ApiResponse<WorkCalendarImportResultDto>>(`${ENDPOINTS.WORK_CALENDAR.import}?workshopId=${workshopId}&year=${year}`, formData);
        return response.data;
    },
    saveDay: async (data: SaveWorkCalendarDayDto) => {
        await api.put<ApiResponse<boolean>>(ENDPOINTS.WORK_CALENDAR.day, data);
    },
};

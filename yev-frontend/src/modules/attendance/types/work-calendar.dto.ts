// Lịch ngày nghỉ của công ty — xem docs/docs-be/attendance-module.md §Lịch ngày nghỉ.
// Giá trị khớp enum WorkCalendarDayType bên BE.
export enum WorkCalendarDayType {
    Sunday = 1,
    PublicHoliday = 2,
    SpecialHoliday = 3,
}

export interface WorkCalendarDayDto {
    // "yyyy-MM-dd"
    date: string;
    dayType: WorkCalendarDayType;
    note: string | null;
}

export interface WorkCalendarImportResultDto {
    year: number;
    importedCount: number;
}

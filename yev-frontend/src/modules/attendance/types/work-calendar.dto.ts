// Values match BE enum WorkCalendarDayType.
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

export interface SaveWorkCalendarDayDto {
    workshopId: number;
    // "yyyy-MM-dd"
    date: string;
    // null = working day (removes the day from the calendar).
    dayType: WorkCalendarDayType | null;
    note: string | null;
}

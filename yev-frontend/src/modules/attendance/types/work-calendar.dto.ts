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

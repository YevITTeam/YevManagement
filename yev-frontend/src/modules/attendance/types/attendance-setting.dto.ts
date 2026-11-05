// Single-row module config. Meal tickets: actual < noMealTicketMaxHours -> none, < mainMealTicketMinHours -> secondary,
// else main; an exact early-window shift is always secondary with no meal-break deduction.
export interface AttendanceSettingDto {
    // Minimum actual OT hours for a main meal ticket.
    mainMealTicketMinHours: number;
    // Below this no meal ticket is given.
    noMealTicketMaxHours: number;
    // Deducted only when the employee ate, outside the early window.
    mealBreakDeductionHours: number;
    // TimeOnly "HH:mm:ss" bounds of the early OT window.
    earlyMealWindowStartTime: string;
    earlyMealWindowEndTime: string;
    // Daily: BE blocks create/edit when exceeded. Monthly/yearly (per-employee override if any): form must be TH3, not blocked.
    dailyOtHourLimit: number;
    monthlyOtHourLimit: number;
    yearlyOtHourLimit: number;
    // Daily limit when the day is a calendar holiday.
    dailyOtHourLimitHoliday: number;
    // TimeOnly "HH:mm:ss" when the daily batch to Managers is assembled.
    batchAutoSendTime: string;
    // Days after completion a Manager-signed office form may still be re-submitted.
    resubmitWindowDays: number;
    // How many days back a new form's date may be.
    backdateDays: number;
    // TimeOnly "HH:mm:ss" of the daily OT data mail to General Affairs.
    generalAffairsSendTime: string;
    // One row per active workshop x department; each pair gets its own mail.
    generalAffairsRecipients: GeneralAffairsRecipientDto[];
}

export interface GeneralAffairsRecipientDto {
    workshopId: number;
    workshopName: string;
    departmentId: number;
    departmentName: string;
    // "a@x; b@y"; null holds this pair's mail back until set.
    emails: string | null;
}

export type UpdateAttendanceSettingDto = AttendanceSettingDto;

// Sends a sample email to check SMTP and font/layout; doesn't touch the setting.
export interface SendTestEmailDto {
    email: string;
}

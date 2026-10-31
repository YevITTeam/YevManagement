// Persisted monthly history from the ledger (no backfill before the feature existed), unlike the live
// Employee.monthToDate/yearToDate counters that reset on rollover.
export interface EmployeeAccumulationHistoryMonthDto {
    month: number;
    totalHours: number;
}

export interface EmployeeAccumulationHistoryYearDto {
    employeeId: number;
    employeeCode: string;
    employeeFullName: string;
    year: number;
    // Always 12 entries (months 1..12).
    months: EmployeeAccumulationHistoryMonthDto[];
    // For past years this is the only source of the yearly total, since Employee.yearToDate reflects only the current year.
    yearTotalHours: number;
    initialBalanceHours?: number;
}

// Only days with completed forms; manual monthly adjustments belong to no day.
export interface EmployeeAccumulationDayDto {
    date: string; // yyyy-MM-dd
    hours: number;
}

// Yearly total = initialBalanceHours + sum of the 12 months.
export interface UpdateEmployeeAccumulationDto {
    year: number;
    initialBalanceHours: number;
    months: EmployeeAccumulationHistoryMonthDto[];
}

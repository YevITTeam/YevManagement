export interface OtOverviewUnitDto {
    id: number;
    nameVn: string;
    nameJp: string | null;
    hours: number;
    overLimitCount: number;
}

export interface OtOverviewEmployeeRowDto {
    employeeId: number;
    code: string;
    fullName: string;
    departmentNameVn: string | null;
    departmentNameJp: string | null;
    monthHours: number;
    monthlyLimit: number;
    yearHours: number;
    yearlyLimit: number;
    isOverMonthly: boolean;
    isOverYearly: boolean;
}

// GET /api/OtOverview — figures cover only the caller's employee scope (Admin: everyone).
// monthHours/monthlyTrend/over* come from the accumulation ledger; dailyHours/by* only count Completed forms.
export interface OtOverviewDto {
    year: number;
    month: number;
    employeeCount: number;
    monthlyLimit: number;
    yearlyLimit: number;
    monthHours: number;
    previousMonthHours: number;
    formsInApproval: number;
    formsCompleted: number;
    formsRejected: number;
    overMonthlyCount: number;
    overYearlyCount: number;
    overAnyCount: number;
    nearLimitCount: number;
    dailyHours: { date: string; hours: number }[];
    monthlyTrend: { month: number; hours: number }[];
    byDepartment: OtOverviewUnitDto[];
    byWorkshop: OtOverviewUnitDto[];
    byOtCase: { code: string; formCount: number; hours: number }[];
    riskEmployees: OtOverviewEmployeeRowDto[];
}

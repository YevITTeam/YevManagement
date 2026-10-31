// One (workshop, department) pair a Department Manager approves for.
export interface EmployeeApprovalScopeDto {
    workshopId: number;
    workshopNameVn: string;
    departmentId: number;
    departmentNameVn: string;
}

export interface EmployeeDto {
    id: number;
    code: string;
    firstName: string;
    lastName: string;
    // Employee's own AD account (nullable), links OT form creators to the right Employee.
    userName: string | null;
    // Computed live from the ledger for the current month/year on every read (not cached).
    monthToDate: number;
    yearToDate: number;
    // Actual + other pending forms; only meaningful from getEmployeesByGroup (scoped to the new form's date), 0 elsewhere.
    projectedDayToDate: number;
    projectedMonthToDate: number;
    projectedYearToDate: number;
    // Nullable: Department Managers use departmentId instead; Workshop Manager/Director have neither (company-wide).
    groupId: number | null;
    groupNameVn: string | null;
    departmentId: number | null;
    departmentNameVn: string | null;
    // Workshop of the employee's group; null for managers, who carry approvalScopes instead.
    workshopId: number | null;
    workshopNameVn: string | null;
    approvalScopes: EmployeeApprovalScopeDto[];

    // null when no job title is assigned.
    jobTitleId: number | null;
    jobTitleName: string | null;

    // Per-employee monthly/yearly limits; null = global default. No per-employee daily limit.
    customMonthlyOtHourLimit: number | null;
    customYearlyOtHourLimit: number | null;
}

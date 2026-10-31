import { api } from "@/lib/client";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import type { EmployeeAccumulationDayDto, EmployeeAccumulationHistoryYearDto, UpdateEmployeeAccumulationDto } from "@/modules/attendance/types/employee-accumulation-history.dto";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import type { WorkshopDto } from "@/modules/attendance/types/workshop.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    EMPLOYEE: {
        getEmployeePageNation: "/Employee/grid-list",
        getEmployeeById: (id: number) => `/Employee/${id}`,
        getEmployeesByGroup: (groupId: number, date?: string) => `/Employee/by-group/${groupId}${date ? `?date=${date}` : ""}`,
        getEmployeesByDepartment: (departmentId: number, workshopId?: number, options?: EmployeesByDepartmentOptions) => {
            const query = new URLSearchParams();
            if (workshopId) query.set("workshopId", String(workshopId));
            if (options?.keyword) query.set("keyword", options.keyword);
            if (options?.jobTitled) query.set("jobTitled", "true");
            if (options?.take) query.set("take", String(options.take));
            const queryString = query.toString();
            return `/Employee/by-department/${departmentId}${queryString ? `?${queryString}` : ""}`;
        },
        getEmployeeByUsername: (userName: string) => `/Employee/by-username/${encodeURIComponent(userName)}`,
        createEmployee: "/Employee",
        updateEmployee: (id: number) => `/Employee/${id}`,
        updateOtLimit: (id: number) => `/Employee/${id}/ot-limit`,
        deleteEmployee: (id: number) => `/Employee/${id}`,
        assignDepartmentJobTitle: (id: number, departmentId: number) => `/Employee/${id}/department-job-title?departmentId=${departmentId}`,
        assignGroupJobTitle: (id: number, groupId: number) => `/Employee/${id}/group-job-title?groupId=${groupId}`,
        getInMyScope: "/Employee/in-my-scope",
        getAccumulationHistory: (id: number, year: number) => `/Employee/${id}/accumulation-history?year=${year}`,
        getAccumulationHistoryForManage: (id: number, year: number) => `/Employee/${id}/accumulation-history/manage?year=${year}`,
        getAccumulationDays: (id: number, year: number, month: number, manage: boolean) =>
            `/Employee/${id}/accumulation-history/days${manage ? "/manage" : ""}?year=${year}&month=${month}`,
        updateAccumulationHistory: (id: number) => `/Employee/${id}/accumulation-history`,
        getMyScope: "/Employee/my-scope",
    },
} as const;

// Caller's viewing scope (may span several departments/groups); UX only to narrow EmployeeList filters,
// BE already scopes the queries itself.
export interface EmployeeScopeDto {
    companyWide: boolean;
    departments: DepartmentDto[];
    groups: GroupDto[];
    workshops: WorkshopDto[];
}

export interface GetEmployeePageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
    departmentId?: number;
    groupId?: number;
    workshopId?: number;
}

// A department can hold thousands of employees: the server always caps the list, so pass jobTitled (holders only)
// and/or keyword + take instead of loading everyone.
export interface EmployeesByDepartmentOptions {
    keyword?: string;
    jobTitled?: boolean;
    take?: number;
}

// No departmentId/groupId: BE derives the scope from the caller's position in the job-title tree.
export interface GetEmployeeInMyScopeParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

// Exactly one of groupId/departmentId is filled, depending on the job title's TerminalLevel.
export interface CreateUpdateEmployeeDto {
    code: string;
    firstName: string;
    lastName: string;
    userName?: string | null;
    groupId: number | null;
    departmentId: number | null;
    // Department Managers: the (workshop, department) pairs they approve for.
    approvalScopes?: { workshopId: number; departmentId: number }[];
    jobTitleId?: number | null;
    // Per-employee OT limits; null = use the global default.
    customMonthlyOtHourLimit: number | null;
    customYearlyOtHourLimit: number | null;
}

// Separate narrow permission (Attendance.Employee.UpdateOtLimit) so department coordinators can edit OT
// limits without general employee edit rights; updateEmployee no longer accepts these fields.
export interface UpdateEmployeeOtLimitDto {
    customMonthlyOtHourLimit: number | null;
    customYearlyOtHourLimit: number | null;
}

export const EmployeeApi = {
    getEmployeePageNation: async (params?: GetEmployeePageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);
        if (params?.departmentId) query.set("DepartmentId", String(params.departmentId));
        if (params?.groupId) query.set("GroupId", String(params.groupId));
        if (params?.workshopId) query.set("WorkshopId", String(params.workshopId));

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.EMPLOYEE.getEmployeePageNation}?${queryString}` : ENDPOINTS.EMPLOYEE.getEmployeePageNation;
        const response = await api.get<ApiResponseWithPageNation<EmployeeDto>>(url);
        return response.data;
    },
    getEmployeeById: async (id: number) => {
        const response = await api.get<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.getEmployeeById(id));
        return response.data;
    },
    // `date` = the form's date (YYYY-MM-DD) so projected accumulation uses that month/year, not today; omit = today.
    getEmployeesByGroup: async (groupId: number, date?: string) => {
        const response = await api.get<ApiResponse<EmployeeDto[]>>(ENDPOINTS.EMPLOYEE.getEmployeesByGroup(groupId, date));
        return response.data;
    },
    getEmployeesByDepartment: async (departmentId: number, workshopId?: number, options?: EmployeesByDepartmentOptions) => {
        const response = await api.get<ApiResponse<EmployeeDto[]>>(ENDPOINTS.EMPLOYEE.getEmployeesByDepartment(departmentId, workshopId, options));
        return response.data;
    },
    // 404 is normal (managers need not have an Employee record); callers treat it as "no suggestion".
    getEmployeeByUsername: async (userName: string) => {
        const response = await api.get<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.getEmployeeByUsername(userName));
        return response.data;
    },
    createEmployee: async (data: CreateUpdateEmployeeDto) => {
        const response = await api.post<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.createEmployee, data);
        return response.data;
    },
    updateEmployee: async (id: number, data: CreateUpdateEmployeeDto) => {
        const response = await api.put<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.updateEmployee(id), { id, ...data });
        return response.data;
    },
    updateOtLimit: async (id: number, data: UpdateEmployeeOtLimitDto) => {
        const response = await api.put<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.updateOtLimit(id), data);
        return response.data;
    },
    deleteEmployee: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.EMPLOYEE.deleteEmployee(id));
        return response.data;
    },
    // Uses the unit's approval-tree permission, not Employee.Update, so tree coordinators can call it; BE limits
    // it to their unit and recomputes groupId/departmentId. jobTitleId null = unassign.
    assignDepartmentJobTitle: async (id: number, departmentId: number, jobTitleId: number | null, workshopId?: number) => {
        const response = await api.put<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.assignDepartmentJobTitle(id, departmentId), { jobTitleId, workshopId: workshopId ?? null });
        return response.data;
    },
    assignGroupJobTitle: async (id: number, groupId: number, jobTitleId: number | null) => {
        const response = await api.put<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.assignGroupJobTitle(id, groupId), { jobTitleId });
        return response.data;
    },
    // Gated by Attendance.OTForm.Approve, not Employee.View, so approvers can look up accumulation.
    getInMyScope: async (params?: GetEmployeeInMyScopeParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.EMPLOYEE.getInMyScope}?${queryString}` : ENDPOINTS.EMPLOYEE.getInMyScope;
        const response = await api.get<ApiResponseWithPageNation<EmployeeDto>>(url);
        return response.data;
    },
    getAccumulationHistory: async (id: number, year: number) => {
        const response = await api.get<ApiResponse<EmployeeAccumulationHistoryYearDto>>(ENDPOINTS.EMPLOYEE.getAccumulationHistory(id, year));
        return response.data;
    },
    getAccumulationHistoryForManage: async (id: number, year: number) => {
        const response = await api.get<ApiResponse<EmployeeAccumulationHistoryYearDto>>(ENDPOINTS.EMPLOYEE.getAccumulationHistoryForManage(id, year));
        return response.data;
    },
    getAccumulationDays: async (id: number, year: number, month: number, manage: boolean) => {
        const response = await api.get<ApiResponse<EmployeeAccumulationDayDto[]>>(ENDPOINTS.EMPLOYEE.getAccumulationDays(id, year, month, manage));
        return response.data;
    },
    updateAccumulationHistory: async (id: number, data: UpdateEmployeeAccumulationDto) => {
        const response = await api.put<ApiResponse<EmployeeAccumulationHistoryYearDto>>(ENDPOINTS.EMPLOYEE.updateAccumulationHistory(id), data);
        return response.data;
    },
    getMyScope: async () => {
        const response = await api.get<ApiResponse<EmployeeScopeDto>>(ENDPOINTS.EMPLOYEE.getMyScope);
        return response.data;
    },
};

export { ENDPOINTS };

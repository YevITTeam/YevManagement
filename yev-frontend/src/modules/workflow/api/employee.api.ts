import { api } from "@/lib/client";
import type { EmployeeDto, CreateUpdateEmployeeDto } from "@/modules/workflow/types/employee.dto";
import type { EmployeeOrgUnitDto, ReplaceEmployeeOrgUnitItemDto } from "@/modules/workflow/types/employee-org-unit.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    EMPLOYEE: {
        getEmployeePageNation: "/Workflow/Employee/grid-list",
        getEmployeeById: (id: number) => `/Workflow/Employee/${id}`,
        createEmployee: "/Workflow/Employee",
        updateEmployee: (id: number) => `/Workflow/Employee/${id}`,
        deleteEmployee: (id: number) => `/Workflow/Employee/${id}`,
        getEmployeeOrgUnits: (id: number) => `/Workflow/Employee/${id}/org-units`,
        replaceEmployeeOrgUnits: (id: number) => `/Workflow/Employee/${id}/org-units`,
        addEmployeeOrgUnit: (id: number) => `/Workflow/Employee/${id}/org-units`,
        employeeOrgUnitAssignment: (assignmentId: number) => `/Workflow/Employee/org-unit-assignments/${assignmentId}`,
    },
} as const;

export interface GetEmployeePageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const EmployeeApi = {
    getEmployeePageNation: async (params?: GetEmployeePageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString
            ? `${ENDPOINTS.EMPLOYEE.getEmployeePageNation}?${queryString}`
            : ENDPOINTS.EMPLOYEE.getEmployeePageNation;

        const response = await api.get<ApiResponseWithPageNation<EmployeeDto>>(url);
        return response.data;
    },

    getEmployeeById: async (id: number) => {
        const response = await api.get<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.getEmployeeById(id));
        return response.data;
    },

    createEmployee: async (data: CreateUpdateEmployeeDto) => {
        const response = await api.post<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.createEmployee, data);
        return response.data;
    },

    updateEmployee: async (id: number, data: CreateUpdateEmployeeDto) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.EMPLOYEE.updateEmployee(id), { id, ...data });
        return response.data;
    },

    deleteEmployee: async (id: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.EMPLOYEE.deleteEmployee(id));
        return response.data;
    },

    getEmployeeOrgUnits: async (id: number) => {
        const response = await api.get<ApiResponse<EmployeeOrgUnitDto[]>>(ENDPOINTS.EMPLOYEE.getEmployeeOrgUnits(id));
        return response.data;
    },

    replaceEmployeeOrgUnits: async (id: number, items: ReplaceEmployeeOrgUnitItemDto[]) => {
        const response = await api.put<ApiResponse<EmployeeOrgUnitDto[]>>(
            ENDPOINTS.EMPLOYEE.replaceEmployeeOrgUnits(id),
            { items }
        );
        return response.data;
    },

    // Per-row assignment operations; validFrom/validTo are kept by the server on update.
    addEmployeeOrgUnit: async (id: number, item: ReplaceEmployeeOrgUnitItemDto) => {
        const response = await api.post<ApiResponse<EmployeeOrgUnitDto[]>>(ENDPOINTS.EMPLOYEE.addEmployeeOrgUnit(id), item);
        return response.data;
    },

    updateEmployeeOrgUnit: async (assignmentId: number, item: ReplaceEmployeeOrgUnitItemDto) => {
        const response = await api.put<ApiResponse<EmployeeOrgUnitDto[]>>(
            ENDPOINTS.EMPLOYEE.employeeOrgUnitAssignment(assignmentId),
            item
        );
        return response.data;
    },

    removeEmployeeOrgUnit: async (assignmentId: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.EMPLOYEE.employeeOrgUnitAssignment(assignmentId));
        return response.data;
    },
};

export { ENDPOINTS };

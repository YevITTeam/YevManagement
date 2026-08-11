import { api } from "@/lib/client";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    EMPLOYEE: {
        getEmployeePageNation: "/Employee/grid-list",
        getAllEmployees: "/Employee/all",
        getEmployeeById: (id: number) => `/Employee/${id}`,
        getEmployeesByGroup: (groupId: number) => `/Employee/by-group/${groupId}`,
        getEmployeesByDepartment: (departmentId: number) => `/Employee/by-department/${departmentId}`,
        getEmployeeByUsername: (userName: string) => `/Employee/by-username/${encodeURIComponent(userName)}`,
        createEmployee: "/Employee",
        updateEmployee: (id: number) => `/Employee/${id}`,
        deleteEmployee: (id: number) => `/Employee/${id}`,
        assignDepartmentJobTitle: (id: number, departmentId: number) => `/Employee/${id}/department-job-title?departmentId=${departmentId}`,
        assignGroupJobTitle: (id: number, groupId: number) => `/Employee/${id}/group-job-title?groupId=${groupId}`,
    },
} as const;

export interface GetEmployeePageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
    departmentId?: number;
    groupId?: number;
}

// groupId/departmentId (2026-08-08): bắt buộc/cấm tuỳ theo TerminalLevel của jobTitleId — chỉ đúng 1
// trong 2 field được điền (xem EmployeeForm.tsx + docs/attendance-api-fe.md §Cây chức vụ).
export interface CreateUpdateEmployeeDto {
    code: string;
    firstName: string;
    lastName: string;
    userName?: string | null;
    monthToDate: number;
    yearToDate: number;
    groupId: number | null;
    departmentId: number | null;
    jobTitleId?: number | null;
}

export const EmployeeApi = {
    getEmployeePageNation: async (params?: GetEmployeePageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);
        if (params?.departmentId) query.set("DepartmentId", String(params.departmentId));
        if (params?.groupId) query.set("GroupId", String(params.groupId));

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.EMPLOYEE.getEmployeePageNation}?${queryString}` : ENDPOINTS.EMPLOYEE.getEmployeePageNation;
        const response = await api.get<ApiResponseWithPageNation<EmployeeDto>>(url);
        return response.data;
    },
    getAllEmployees: async () => {
        const response = await api.get<ApiResponse<EmployeeDto[]>>(ENDPOINTS.EMPLOYEE.getAllEmployees);
        return response.data;
    },
    getEmployeeById: async (id: number) => {
        const response = await api.get<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.getEmployeeById(id));
        return response.data;
    },
    // Chọn nhân viên hàng loạt khi lập đơn OT (docs/attendance-api-fe.md §3.5).
    getEmployeesByGroup: async (groupId: number) => {
        const response = await api.get<ApiResponse<EmployeeDto[]>>(ENDPOINTS.EMPLOYEE.getEmployeesByGroup(groupId));
        return response.data;
    },
    // Toàn bộ nhân viên active thuộc Phòng ban (mọi Bộ phận con) — dùng ở màn "Cây duyệt Phòng ban"
    // để xem ai đang giữ Chức vụ nào và gán nhanh Chức vụ ngay tại đó.
    getEmployeesByDepartment: async (departmentId: number) => {
        const response = await api.get<ApiResponse<EmployeeDto[]>>(ENDPOINTS.EMPLOYEE.getEmployeesByDepartment(departmentId));
        return response.data;
    },
    // Tra Group của 1 userName bất kỳ — gợi ý cho Admin ở màn "Phân quyền duyệt" (docs §3.5). 404 là
    // bình thường (Trưởng phòng/Trưởng xưởng/TGĐ/Trưởng Bộ phận không nhất thiết có hồ sơ Employee),
    // caller tự bắt lỗi và coi như "không có gợi ý" thay vì báo lỗi.
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
    deleteEmployee: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.EMPLOYEE.deleteEmployee(id));
        return response.data;
    },
    // Gán/gỡ Chức vụ CÓ PHẠM VI (2026-08-11c) — dùng chung permission với chính cây duyệt của đơn vị đó
    // (Attendance.DepartmentApprovalStep.Update/GroupApprovalStep.Update), KHÔNG cần Attendance.Employee.Update
    // — Người phụ trách Cây duyệt (không phải Admin) gọi được, BE tự chặn nếu Employee không thuộc
    // đúng Bộ phận/Nhóm họ phụ trách. BE tự tính lại groupId/departmentId theo Chức vụ mới, FE chỉ gửi
    // jobTitleId (null = gỡ chức vụ).
    assignDepartmentJobTitle: async (id: number, departmentId: number, jobTitleId: number | null) => {
        const response = await api.put<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.assignDepartmentJobTitle(id, departmentId), { jobTitleId });
        return response.data;
    },
    assignGroupJobTitle: async (id: number, groupId: number, jobTitleId: number | null) => {
        const response = await api.put<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.assignGroupJobTitle(id, groupId), { jobTitleId });
        return response.data;
    },
};

export { ENDPOINTS };

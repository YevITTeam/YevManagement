import { api } from "@/lib/client";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import type { EmployeeAccumulationHistoryYearDto } from "@/modules/attendance/types/employee-accumulation-history.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    EMPLOYEE: {
        getEmployeePageNation: "/Employee/grid-list",
        getAllEmployees: "/Employee/all",
        getEmployeeById: (id: number) => `/Employee/${id}`,
        getEmployeesByGroup: (groupId: number, date?: string) => `/Employee/by-group/${groupId}${date ? `?date=${date}` : ""}`,
        getEmployeesByDepartment: (departmentId: number) => `/Employee/by-department/${departmentId}`,
        getEmployeeByUsername: (userName: string) => `/Employee/by-username/${encodeURIComponent(userName)}`,
        createEmployee: "/Employee",
        updateEmployee: (id: number) => `/Employee/${id}`,
        updateOtLimit: (id: number) => `/Employee/${id}/ot-limit`,
        deleteEmployee: (id: number) => `/Employee/${id}`,
        assignDepartmentJobTitle: (id: number, departmentId: number) => `/Employee/${id}/department-job-title?departmentId=${departmentId}`,
        assignGroupJobTitle: (id: number, groupId: number) => `/Employee/${id}/group-job-title?groupId=${groupId}`,
        getInMyScope: "/Employee/in-my-scope",
        getAccumulationHistory: (id: number, year: number) => `/Employee/${id}/accumulation-history?year=${year}`,
        getMyScope: "/Employee/my-scope",
    },
} as const;

// Phạm vi xem nhân viên của người gọi (2026-09-03) — Admin/company-wide hay chỉ đúng 1 Phòng ban/Nhóm.
// FE dùng để thu hẹp dropdown lọc ở EmployeeList.tsx, KHÔNG dùng để enforce (BE đã tự scope
// GetPagedAsync/GetAllActiveAsync rồi, đây chỉ phục vụ UX — chọn ngoài phạm vi trước đây ra bảng rỗng
// không rõ lý do).
export interface EmployeeScopeDto {
    companyWide: boolean;
    departmentId: number | null;
    departmentNameVn: string | null;
    groupId: number | null;
    groupNameVn: string | null;
}

export interface GetEmployeePageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
    departmentId?: number;
    groupId?: number;
}

// Params cho GET /in-my-scope — không có departmentId/groupId (phạm vi tự suy theo Cây chức vụ của
// người gọi ở BE, không phải filter tự chọn như GetEmployeePageNationParams).
export interface GetEmployeeInMyScopeParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

// groupId/departmentId (2026-08-08): bắt buộc/cấm tuỳ theo TerminalLevel của jobTitleId — chỉ đúng 1
// trong 2 field được điền (xem EmployeeForm.tsx + docs/attendance-api-fe.md §Cây chức vụ).
export interface CreateUpdateEmployeeDto {
    code: string;
    firstName: string;
    lastName: string;
    userName?: string | null;
    groupId: number | null;
    departmentId: number | null;
    jobTitleId?: number | null;
    // Giới hạn giờ OT/tháng/năm RIÊNG cho nhân viên này — null = dùng mặc định chung (2026-08-26, xem
    // EmployeeForm.tsx).
    customMonthlyOtHourLimit: number | null;
    customYearlyOtHourLimit: number | null;
}

// Sửa RIÊNG giới hạn OT (2026-08-29) — permission hẹp Attendance.Employee.UpdateOtLimit, KHÁC
// updateEmployee (PUT /{id}, Attendance.Employee.Update — không còn nhận 2 field này nữa). Dùng cho
// Người phụ trách Bộ phận (không có quyền sửa nhân viên nói chung) — xem docs/attendance-api-fe.md
// §Phân quyền theo Phòng ban.
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
    // Chọn nhân viên hàng loạt khi lập đơn OT (docs/attendance-api-fe.md §3.5). date = ngày trên đơn
    // đang tạo (YYYY-MM-DD) — để lũy kế Dự kiến (projectedMonthToDate/YearToDate) scope đúng tháng/năm
    // của đơn đó thay vì hôm nay thực tế (2026-08-19, xem docs §Lũy kế Dự kiến). Bỏ trống = hôm nay.
    getEmployeesByGroup: async (groupId: number, date?: string) => {
        const response = await api.get<ApiResponse<EmployeeDto[]>>(ENDPOINTS.EMPLOYEE.getEmployeesByGroup(groupId, date));
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
    updateOtLimit: async (id: number, data: UpdateEmployeeOtLimitDto) => {
        const response = await api.put<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.updateOtLimit(id), data);
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
    // Nhân viên trong phạm vi quản lý của người GIỮ QUYỀN DUYỆT (Attendance.OTForm.Approve) — KHÔNG
    // cần Attendance.Employee.View. Dùng cho màn "Lũy kế nhân viên" tra cứu (2026-08-11d).
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
    getMyScope: async () => {
        const response = await api.get<ApiResponse<EmployeeScopeDto>>(ENDPOINTS.EMPLOYEE.getMyScope);
        return response.data;
    },
};

export { ENDPOINTS };

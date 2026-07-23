import { api } from "@/lib/client";
import type { AuditTrailDto } from "@/modules/pc-management/types/audit-trail.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

// Route /AuditTrail — docs/asset-api-fe.md §7b. Chỉ đọc, ghi tự động ở BE mỗi lần Create/Update/
// Delete/Restore bất kỳ entity Asset nào. Permission Asset.AuditTrail.View (Admin gán riêng).
const ENDPOINTS = {
    AUDIT_TRAIL: {
        getAuditTrailPageNation: "/AuditTrail/grid-list",
        getAuditTrailByRecord: "/AuditTrail/record",
    },
} as const;

export interface GetAuditTrailPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    tableName?: string;
    recordId?: number;
    // Tìm gần đúng (contains) theo tên đối tượng bị tác động (docs §7b.1) — ô search "tìm theo
    // mã máy / IP".
    recordName?: string;
    action?: string;
    changedBy?: string;
    fromDate?: string;
    toDate?: string;
}

export const AuditTrailApi = {
    getAuditTrailPageNation: async (params?: GetAuditTrailPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("pageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("pageSize", String(params.pageSize));
        if (params?.tableName) query.set("tableName", params.tableName);
        if (params?.recordId !== undefined) query.set("recordId", String(params.recordId));
        if (params?.recordName) query.set("recordName", params.recordName);
        if (params?.action) query.set("action", params.action);
        if (params?.changedBy) query.set("changedBy", params.changedBy);
        if (params?.fromDate) query.set("fromDate", params.fromDate);
        if (params?.toDate) query.set("toDate", params.toDate);
        const queryString = query.toString();
        const url = queryString
            ? `${ENDPOINTS.AUDIT_TRAIL.getAuditTrailPageNation}?${queryString}`
            : ENDPOINTS.AUDIT_TRAIL.getAuditTrailPageNation;
        const response = await api.get<ApiResponseWithPageNation<AuditTrailDto>>(url);
        return response.data;
    },
    // Dùng cho tab "Lịch sử" trong màn chi tiết 1 bản ghi (vd 1 Device cụ thể) — không phân trang,
    // mới nhất trước (docs §7b.2).
    getAuditTrailByRecord: async (tableName: string, recordId: number) => {
        const query = new URLSearchParams({ tableName, recordId: String(recordId) });
        const response = await api.get<ApiResponse<AuditTrailDto[]>>(
            `${ENDPOINTS.AUDIT_TRAIL.getAuditTrailByRecord}?${query.toString()}`
        );
        return response.data;
    },
};

export { ENDPOINTS };

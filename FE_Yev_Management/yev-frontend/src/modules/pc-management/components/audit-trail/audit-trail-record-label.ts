import { IpApi } from "@/modules/pc-management/api/ip-api";

// AuditTrail chỉ lưu tableName + recordId thô (docs/asset-api-fe.md §7b.1) — với các bảng con
// (vd IpAddress) recordId không tự nói lên "đối tượng nào" (vd IP cụ thể) vì giá trị đó không
// đổi lúc gán/gỡ máy nên không xuất hiện trong oldValues/newValues. Đăng ký cách tra thêm nhãn
// hiển thị theo tableName ở đây để mở rộng cho các bảng con khác sau này.
export type AuditRecordLabelResolver = (recordId: number) => Promise<string | null>;

export const auditRecordLabelResolvers: Record<string, AuditRecordLabelResolver> = {
    IpAddress: async (recordId) => {
        const ip = await IpApi.getIpAddressById(recordId);
        return ip.ipAddress;
    },
};

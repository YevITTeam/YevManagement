// GET/PUT /api/AssetSetting — cấu hình chung của module Asset, hiện chỉ có 1 field:
// sau bao nhiêu tháng kể từ khi thiết bị hết hạn sử dụng (expirationDate) thì hệ thống tự động
// chuyển trạng thái thiết bị sang "Chờ thanh lý". Không phân trang, không có Id — luôn thao tác
// trên đúng 1 bản ghi cấu hình duy nhất.
export interface AssetSettingDto {
    liquidationAfterMonths: number;
    // Added 2026-09-17, renamed same day (was networkCheckBranchId): which single Branch the whole
    // ServerCheck feature applies to — both the daily scan session (§1.19) and the "Kiểm tra network"
    // ping button (§1.20). Null = no branch filter (escape hatch, not the intended steady state).
    serverCheckBranchId: number | null;
    serverCheckBranchName: string | null;
}

export interface UpdateAssetSettingDto {
    liquidationAfterMonths: number;
    serverCheckBranchId?: number | null;
}

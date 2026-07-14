namespace Asset.Domain.Entities;

// Cấu hình hệ thống của module Asset — luôn chỉ có đúng 1 dòng (Id=1), sửa qua API thay
// vì appsettings.json để Admin đổi được ngay không cần deploy lại (xem docs/asset-module.md).
public partial class AssetSetting
{
    public int Id { get; set; }

    // Số tháng tính từ ExpirationDate (hạn sử dụng) để tự động chuyển Device đang
    // "Chờ thanh lý" (PendingLiquidation) sang "Đã thanh lý" (Liquidated). Mặc định 2.
    public int LiquidationAfterMonths { get; set; }
}

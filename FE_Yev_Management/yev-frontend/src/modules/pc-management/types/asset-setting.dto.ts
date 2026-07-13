// GET/PUT /api/AssetSetting — cấu hình chung của module Asset, hiện chỉ có 1 field:
// sau bao nhiêu tháng kể từ khi thiết bị hết hạn sử dụng (expirationDate) thì hệ thống tự động
// chuyển trạng thái thiết bị sang "Chờ thanh lý". Không phân trang, không có Id — luôn thao tác
// trên đúng 1 bản ghi cấu hình duy nhất.
export interface AssetSettingDto {
    liquidationAfterMonths: number;
}

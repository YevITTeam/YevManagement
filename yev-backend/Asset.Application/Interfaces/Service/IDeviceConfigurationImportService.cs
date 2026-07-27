using Asset.Application.Dtos.DeviceConfigurationImports;

namespace Asset.Application.Interfaces.Service
{
    public interface IDeviceConfigurationImportService
    {
        Task<DeviceConfigurationImportPreviewResultDto> PreviewAsync(Stream excelFileStream, string? fileName = null);
        Task<DeviceConfigurationImportConfirmResultDto> ConfirmAsync(ConfirmDeviceConfigurationImportDto request);

        // Đối chiếu: parse lại đúng file Tanium vừa chọn (không phụ thuộc Preview/Confirm đã chạy
        // hay chưa) và trả về file .xlsx liệt kê các Device đang Status=InUse mà KHÔNG khớp được
        // với dòng nào trong file — xem chi tiết luật ở DeviceConfigurationImportService.
        // deviceCodePrefixes: danh sách tiền tố mã máy do người dùng nhập (VD "YDC","YDF","YLC") —
        // chỉ Device có DeviceCode bắt đầu bằng 1 trong các tiền tố này mới được đối chiếu; rỗng/null
        // = không lọc theo tiền tố (giữ hành vi cũ, lấy toàn bộ Device InUse).
        Task<DeviceMissingInTaniumReportDto> BuildMissingDevicesReportAsync(Stream excelFileStream, string? fileName = null, IEnumerable<string>? deviceCodePrefixes = null);
    }
}

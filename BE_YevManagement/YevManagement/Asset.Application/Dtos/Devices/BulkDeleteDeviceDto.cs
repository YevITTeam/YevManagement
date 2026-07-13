using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.Devices
{
    // Xóa mềm hàng loạt Device — chỉ áp dụng cho thiết bị đang Status=Liquidated (Đã thanh lý).
    public class BulkDeleteDeviceRequestDto
    {
        [Required(ErrorMessage = "Danh sách thiết bị cần xóa không được để trống.")]
        [MinLength(1, ErrorMessage = "Danh sách thiết bị cần xóa không được để trống.")]
        public List<int> Ids { get; set; } = new();
    }

    // 1 dòng thiết bị bị bỏ qua khi xóa hàng loạt (không chặn cả batch — cùng pattern
    // DeviceImportConfirmResultDto.SkippedRows).
    public class BulkDeleteSkippedDeviceDto
    {
        public int Id { get; set; }
        public string DeviceCode { get; set; } = null!;
        public string Reason { get; set; } = null!;
    }

    public class BulkDeleteDeviceResultDto
    {
        public int DeletedCount { get; set; }
        public List<BulkDeleteSkippedDeviceDto> SkippedDevices { get; set; } = new();
    }
}

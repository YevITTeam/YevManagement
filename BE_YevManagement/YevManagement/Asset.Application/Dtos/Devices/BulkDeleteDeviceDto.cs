using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.Devices
{
    // Bulk soft-delete Device — only applies to devices currently Status=Liquidated.
    public class BulkDeleteDeviceRequestDto
    {
        [Required(ErrorMessage = "Danh sách thiết bị cần xóa không được để trống.")]
        [MinLength(1, ErrorMessage = "Danh sách thiết bị cần xóa không được để trống.")]
        public List<int> Ids { get; set; } = new();
    }

    // 1 device row that was skipped during bulk deletion (does not block the whole batch —
    // same pattern as DeviceImportConfirmResultDto.SkippedRows).
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

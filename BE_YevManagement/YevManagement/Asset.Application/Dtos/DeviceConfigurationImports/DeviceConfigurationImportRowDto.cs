namespace Asset.Application.Dtos.DeviceConfigurationImports
{
    // Represents 1 row parsed from file inventory Tanium (Computer Name/Tanium Client IP
    // Address/Manufacturer/Model/CPU/RAM/Size — cột "Last Logged In User" bị bỏ qua theo
    // yêu cầu). Dùng cho cả response Preview (server điền ResolvedXxx/IsValid/Errors) và
    // request Confirm (client gửi lại nguyên field thô, server tự resolve lại, không tin
    // Id do client gửi).
    public class DeviceConfigurationImportRowDto
    {
        public int RowNumber { get; set; }

        public string? ComputerName { get; set; }
        public string? TaniumIpAddress { get; set; }
        public string? Manufacturer { get; set; }
        public string? Model { get; set; }
        public string? Cpu { get; set; }
        public string? Ram { get; set; }
        public string? Size { get; set; }

        // Mã/Tên tách được từ ComputerName (xem thuật toán ở DeviceConfigurationImportService).
        public string? ParsedDeviceCode { get; set; }
        public string? ParsedDeviceName { get; set; }

        public int? ResolvedDeviceId { get; set; }
        public int? ResolvedIpAddressId { get; set; }

        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();

        // Cảnh báo không chặn dòng (VD: IP Tanium không tồn tại trong hệ thống nên bỏ
        // qua việc cập nhật IP, nhưng cấu hình máy vẫn được tạo/cập nhật bình thường).
        public List<string> Warnings { get; set; } = new();
    }
}

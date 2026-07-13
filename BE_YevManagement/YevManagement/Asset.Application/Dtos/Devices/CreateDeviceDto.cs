using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Asset.Application.Dtos.Devices
{
    public class CreateDeviceDto
    {
        [Required(ErrorMessage = "Mã thiết bị không được để trống")]
        public string DeviceCode { get; set; } = null!;

        [Required(ErrorMessage = "Tên thiết bị không được để trống")]
        public string DeviceName { get; set; } = null!;

        [Required(ErrorMessage = "Loại thiết bị không được để trống")]
        public int DeviceTypeId { get; set; }

        [Required(ErrorMessage = "Nhà cung cấp không được để trống")]
        public int SupplierId { get; set; }

        [Required(ErrorMessage = "Chi nhánh không được để trống")]
        public int BranchId { get; set; }

        // Nhóm/Bộ phận: optional — xác định thiết bị đang ở chỗ nào bên cạnh Branch.
        public int? GroupId { get; set; }

        public int? DepartmentId { get; set; }

        [Required(ErrorMessage = "Người quản lý không được để trống")]
        public string Manager { get; set; } = null!;

        [Required(ErrorMessage = "Email không được để trống")]
        [MinLength(1, ErrorMessage = "Cần ít nhất 1 email")]
        public List<DeviceEmailInputDto> Emails { get; set; } = new();

        [Required(ErrorMessage = "Ngày mua không được để trống")]
        public DateTime PurchaseDate { get; set; }

        [Required(ErrorMessage = "Số tháng khấu hao không được để trống")]
        [Range(1, 600, ErrorMessage = "Số tháng khấu hao phải từ 1 đến 600")]
        public int DepreciationMonths { get; set; }

        public bool IsOutsourced { get; set; }

        [Range(0, 3, ErrorMessage = "Trạng thái không hợp lệ")]
        public int Status { get; set; }

        public string? Note { get; set; }

        [StringLength(100, ErrorMessage = "Số Serial không được vượt quá 100 ký tự")]
        public string? SerialNumber { get; set; }

        public bool IsUseUsb { get; set; }

        public List<int> IpAddressIds { get; set; } = new();

        // Gợi ý "máy MỚI nào sẽ thay thế cho chính thiết bị này" (set tay khi hiếm khi cần
        // tạo sẵn gợi ý cho 1 máy cũ đã tồn tại). Optional — trỏ tới Id 1 Device khác đã có
        // sẵn trong hệ thống, chỉ dùng để FE điền sẵn NewDeviceId trên màn "Chuyển máy" mở
        // trên chính thiết bị này sau này, không tự động chuyển máy. Luồng phổ biến (import
        // Excel cột "MQL Cũ") set field này qua UpdateAsync trên máy CŨ sau khi máy MỚI được
        // tạo xong, không set ở đây lúc Create — xem DeviceImportService.
        public int? SuggestedNewDeviceId { get; set; }
    }
}

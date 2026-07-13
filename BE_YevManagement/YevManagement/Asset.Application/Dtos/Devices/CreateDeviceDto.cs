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

        // Gợi ý "máy cũ được thay thế bởi thiết bị này" (điền từ MQL Cũ khi import Excel,
        // hoặc chọn tay khi tạo Device thường). Optional — chỉ dùng để FE điền sẵn
        // NewDeviceId trên màn "Chuyển máy" sau này, không tự động chuyển máy.
        public int? ReplacesOldDeviceId { get; set; }
    }
}

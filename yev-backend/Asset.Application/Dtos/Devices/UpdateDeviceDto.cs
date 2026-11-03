using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.Devices
{
    public class UpdateDeviceDto
    {
        public int Id { get; set; }

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

        public int? GroupId { get; set; }

        public int? DepartmentId { get; set; }

        // Manager/Emails: optional at Create/Update — a device not yet in use has no assigned
        // user, only Note is mandatory to explain its status (2026-08-01 business decision).
        public string Manager { get; set; } = string.Empty;

        // DOMAIN\user of the person using the device; Identity matches users on it.
        [StringLength(150, ErrorMessage = "Tài khoản domain không được vượt quá 150 ký tự")]
        [RegularExpression(@"^[^\\\s]+\\[^\\\s]+$", ErrorMessage = "Tài khoản domain phải có dạng DOMAIN\\username")]
        public string? ManagerDomainAccount { get; set; }

        public List<DeviceEmailInputDto> Emails { get; set; } = new();

        [Required(ErrorMessage = "Ngày mua không được để trống")]
        public DateTime PurchaseDate { get; set; }

        [Required(ErrorMessage = "Số tháng khấu hao không được để trống")]
        [Range(1, 600, ErrorMessage = "Số tháng khấu hao phải từ 1 đến 600")]
        public int DepreciationMonths { get; set; }

        public bool IsOutsourced { get; set; }

        [Range(0, 4, ErrorMessage = "Trạng thái không hợp lệ")]
        public int Status { get; set; }

        [Required(ErrorMessage = "Ghi chú không được để trống")]
        public string Note { get; set; } = null!;

        [StringLength(100, ErrorMessage = "Số Serial không được vượt quá 100 ký tự")]
        public string? SerialNumber { get; set; }

        public bool IsUseUsb { get; set; }

        public bool RequiresDailyCheck { get; set; }

        public List<int> IpAddressIds { get; set; } = new();

        // Suggests "which NEW device will replace this device" — set on the OLD device. See
        // the full note on CreateDeviceDto.SuggestedNewDeviceId.
        public int? SuggestedNewDeviceId { get; set; }
    }
}

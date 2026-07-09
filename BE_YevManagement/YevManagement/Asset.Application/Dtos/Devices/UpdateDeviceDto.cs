using System;
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

        [Required(ErrorMessage = "Người quản lý không được để trống")]
        public string Manager { get; set; } = null!;

        [Required(ErrorMessage = "Email không được để trống")]
        [EmailAddress(ErrorMessage = "Email không đúng định dạng")]
        public string Email { get; set; } = null!;

        [Required(ErrorMessage = "Ngày mua không được để trống")]
        public DateTime PurchaseDate { get; set; }

        [Required(ErrorMessage = "Số tháng khấu hao không được để trống")]
        [Range(1, 600, ErrorMessage = "Số tháng khấu hao phải từ 1 đến 600")]
        public int DepreciationMonths { get; set; }

        public bool IsOutsourced { get; set; }

        [Range(0, 3, ErrorMessage = "Trạng thái không hợp lệ")]
        public int Status { get; set; }

        public string? Note { get; set; }

        public int? IpAddressId { get; set; }
    }
}

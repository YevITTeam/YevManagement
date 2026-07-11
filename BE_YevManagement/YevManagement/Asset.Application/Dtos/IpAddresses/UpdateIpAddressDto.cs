using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.IpAddresses
{
    // Cập nhật IpAddress — CHỈ cho đổi Status + Note (2026-07-11, quyết định người dùng).
    // Không cho đổi IpAddress/IpPrefix/DeviceId (IP sinh cố định theo prefix; gán/gỡ thiết
    // bị đi qua action assign/unassign riêng). Status hợp lệ: 0=Chưa gán, 1=Đã gán (khác);
    // 2=Đã gán chỉ do hệ thống tự set khi có DeviceId, không đặt tay được ở đây.
    public class UpdateIpAddressDto
    {
        [Required(ErrorMessage = "Id không được để trống")]
        public int Id { get; set; }

        [Required(ErrorMessage = "Trạng thái không được để trống")]
        [Range(0, 2, ErrorMessage = "Trạng thái không hợp lệ")]
        public int Status { get; set; }

        public string? Note { get; set; }
    }
}

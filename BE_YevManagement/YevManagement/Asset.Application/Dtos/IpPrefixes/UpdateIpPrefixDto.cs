using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.IpPrefixes
{
    // Không gồm Prefix — 3 octet định danh dải đã sinh sẵn 255 IpAddress con theo giá trị này,
    // đổi Prefix vẫn phải xoá + tạo lại dải mới (giữ nguyên quyết định cũ). Update chỉ cho sửa
    // Chi nhánh + cấu hình mạng (SubnetMask/Gateway/DNS/Description) khi có thay đổi thực tế,
    // thay vì phải xoá dải cũ rồi tạo lại (mất hết IpAddress con đã gán cho thiết bị).
    public class UpdateIpPrefixDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Chi nhánh không được để trống")]
        public int BranchId { get; set; }

        public string? SubnetMask { get; set; }

        public string? Gateway { get; set; }

        public string? PreferredDns { get; set; }

        public string? AlternateDns { get; set; }

        public string? Description { get; set; }
    }
}

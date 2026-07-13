using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.IpPrefixes
{
    public class IpPrefixDto
    {
        public int Id { get; set; }
        public string Prefix { get; set; } = null!;
        public int? BranchId { get; set; }
        public string? BranchName { get; set; }
        public string? SubnetMask { get; set; }
        public string? Gateway { get; set; }
        public string? PreferredDns { get; set; }
        public string? AlternateDns { get; set; }
        public string? Description { get; set; }

        // Bỏ tổng "Số IP" (luôn = 255 cho mọi prefix vì mỗi dải sinh cố định 1..255). Thay bằng
        // số IP đang sử dụng (Status != Available) và số IP chưa sử dụng (Status == Available)
        // trong dải, giúp FE hiển thị/lọc dải theo mức độ đã dùng.
        public int UsedIpCount { get; set; }
        public int AvailableIpCount { get; set; }
    }
}

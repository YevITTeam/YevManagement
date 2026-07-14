using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Asset.Application.Dtos.IpPrefixes
{
    public class CreateIpPrefixDto
    {
        [Required(ErrorMessage = "Prefix không được để trống")]
        [RegularExpression(@"^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$",
            ErrorMessage = "Prefix phải gồm đúng 3 octet hợp lệ, ví dụ 10.3.4")]
        public string Prefix { get; set; } = null!;

        [Required(ErrorMessage = "Chi nhánh không được để trống")]
        public int BranchId { get; set; }

        public string? SubnetMask { get; set; }

        public string? Gateway { get; set; }

        public string? PreferredDns { get; set; }

        public string? AlternateDns { get; set; }

        public string? Description { get; set; }
    }
}

using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Yev.Entities.Users
{
    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string UserName { get; set; } // Sẽ lưu dạng DOMAIN\TenNhanVien

        public string? FullName { get; set; }

        [MaxLength(45)]
        public string? LastLoginIp { get; set; }

        [MaxLength(100)]
        public string? DeviceName { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // Mối quan hệ 1-Nhiều với bảng trung gian
        public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    }
}

using System.ComponentModel.DataAnnotations;

namespace Identity.Application.Dtos.LoginQrDto
{
    // Returned once, right after generation: the raw code is never stored and cannot be fetched again.
    public class LoginQrGeneratedDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = null!;
        public string? FullName { get; set; }

        // Exact text to encode into the QR image.
        public string QrPayload { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
    }

    public class LoginQrBatchRequestDto
    {
        [Required(ErrorMessage = "Chưa chọn người dùng.")]
        [MinLength(1, ErrorMessage = "Chưa chọn người dùng.")]
        [MaxLength(200, ErrorMessage = "Mỗi lần chỉ được tạo mã cho tối đa 200 người.")]
        public List<int> UserIds { get; set; } = new();
    }

    // One row per user that currently has an active (non-revoked) code.
    public class LoginQrStatusDto
    {
        public int UserId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastUsedAt { get; set; }
        public int UseCount { get; set; }
    }

    public class LoginQrLogDto
    {
        public int Id { get; set; }
        public int? UserId { get; set; }
        public string Action { get; set; } = null!;
        public int? ActorUserId { get; set; }
        public string? ActorName { get; set; }
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
        public string? Note { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class QrLoginRequestDto
    {
        [Required(ErrorMessage = "Mã QR không được để trống.")]
        [MaxLength(200, ErrorMessage = "Mã QR không hợp lệ.")]
        public string Code { get; set; } = null!;
    }
}

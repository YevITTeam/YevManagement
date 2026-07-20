using System.Security.Cryptography;

namespace Shared.Application.Helper
{
    // Sinh token ngẫu nhiên mạnh dùng cho link xác nhận qua email (xác nhận cập nhật chữ ký, duyệt/
    // từ chối đơn tăng ca qua email) — đây là bề mặt public [AllowAnonymous] đầu tiên của hệ thống,
    // token TỰ nó là thông tin xác thực duy nhất nên phải đủ dài để chống đoán/brute-force.
    public static class TokenHelper
    {
        public static string GenerateSecureToken()
        {
            var bytes = RandomNumberGenerator.GetBytes(32);
            return Convert.ToBase64String(bytes)
                .Replace('+', '-')
                .Replace('/', '_')
                .TrimEnd('=');
        }
    }
}

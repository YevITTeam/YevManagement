using Attendance.Application.Dtos.UserSignatures;

namespace Attendance.Application.Interfaces.Service
{
    public interface IUserSignatureService
    {
        Task<UserSignatureDto> GetByUserNameAsync(string userName);

        // Không upsert ngay — tạo PendingSignatureConfirmation + gửi email xác nhận cho chính
        // người gọi (xem docs/attendance-module.md — xác thực qua email).
        Task RequestUpdateAsync(string userName, UpsertUserSignatureDto request);

        // 2 hàm dưới phục vụ trang xác nhận nhỏ (public, [AllowAnonymous] ở Controller) mà FE mở
        // khi người dùng bấm link trong email — token tự nó là thông tin xác thực duy nhất.
        Task<SignatureConfirmationPreviewDto> GetPendingConfirmationAsync(string token);
        Task<UserSignatureDto> ConfirmAsync(string token);
    }
}

using Attendance.Application.Dtos.UserSignatures;

namespace Attendance.Application.Interfaces.Service
{
    public interface IUserSignatureService
    {
        Task<UserSignatureDto> GetByUserNameAsync(string userName);

        // Does not upsert immediately — creates a PendingSignatureConfirmation + sends a confirmation
        // email to the caller themself (see docs/attendance-module.md — email-based verification).
        Task RequestUpdateAsync(string userName, UpsertUserSignatureDto request);

        // The 2 functions below serve a small confirmation page (public, [AllowAnonymous] on the
        // Controller) that the FE opens when the user clicks the link in the email — the token itself
        // is the sole piece of verification.
        Task<SignatureConfirmationPreviewDto> GetPendingConfirmationAsync(string token);
        Task<UserSignatureDto> ConfirmAsync(string token);

        // Admin đặt THẲNG chữ ký cho người khác, KHÔNG qua email-confirm (2026-09-03) — CHỈ gọi được
        // từ EmployeeIdentityLinkImportService (import hàng loạt, permission Identity.User.BulkImport,
        // Admin-only). Luồng tự phục vụ (RequestUpdateAsync/ConfirmAsync) vẫn là đường DUY NHẤT để 1
        // người tự đổi chữ ký của chính mình — đánh đổi bảo mật này CÓ CHỦ ĐÍCH, chỉ dành riêng cho
        // import hàng loạt lúc Admin thiết lập tài khoản mới.
        Task<UserSignatureDto> AdminSetSignatureAsync(string userName, byte[] signatureImage);
    }
}

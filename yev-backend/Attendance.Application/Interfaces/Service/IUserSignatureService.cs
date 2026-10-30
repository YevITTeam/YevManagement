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

        // Sets another account's signature directly, without email confirmation; callers must be Admin-only
        // (identity-link bulk import, PUT UserSignature/{userName}).
        Task<UserSignatureDto> AdminSetSignatureAsync(string userName, byte[] signatureImage);
    }
}

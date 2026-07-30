using Attendance.Application.Dtos.SecondaryPasswords;

namespace Attendance.Application.Interfaces.Service
{
    public interface ISecondaryPasswordService
    {
        Task<SecondaryPasswordStatusDto> GetStatusAsync(string userName);

        // Does not upsert immediately — creates a PendingSecondaryPasswordConfirmation + sends a
        // confirmation email to the caller themself (mirrors UserSignatureService.RequestUpdateAsync).
        Task RequestUpdateAsync(string userName, UpsertSecondaryPasswordDto request);

        // The 2 functions below serve a small confirmation page (public, [AllowAnonymous] on the
        // Controller) that the FE opens when the user clicks the link in the email.
        Task<SecondaryPasswordConfirmationPreviewDto> GetPendingConfirmationAsync(string token);
        Task ConfirmAsync(string token);

        // Called by OtFormService before every sign/approve/reject action — throws DomainException
        // if the user has not registered a secondary password yet, or if the password is wrong.
        Task VerifyAsync(string userName, string plainPassword);
    }
}

using Workflow.Application.Dtos.EmployeeSignatures;

namespace Workflow.Application.Interfaces.Service
{
    public interface IEmployeeSignatureService
    {
        Task<EmployeeSignatureDto> GetMineAsync(int? currentUserId);

        // Does not upsert: creates a pending confirmation and emails the caller, guarding against hijacked sessions.
        Task RequestUpdateAsync(int? currentUserId, UpsertEmployeeSignatureDto request);

        // Used by the anonymous email-link confirmation page; the token is the only credential.
        Task<SignatureConfirmationPreviewDto> GetPendingConfirmationAsync(string token);
        Task<EmployeeSignatureDto> ConfirmAsync(string token);
    }
}

namespace Attendance.Application.Dtos.UserSignatures
{
    // Returned so the FE can render a small confirmation page (email link, no SPA login required) —
    // just enough information for the user to confirm the signature image they just requested to
    // update, without exposing anything extra.
    public class SignatureConfirmationPreviewDto
    {
        public string UserName { get; set; } = null!;
        public byte[] SignatureImage { get; set; } = null!;
        public DateTime ExpiresAt { get; set; }
    }
}

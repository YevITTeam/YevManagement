namespace Attendance.Application.Dtos.SecondaryPasswords
{
    // Returned so the FE can render a small confirmation page (email link, no SPA login required) —
    // the password itself is never sent back, only enough context to confirm "yes, this is my request".
    public class SecondaryPasswordConfirmationPreviewDto
    {
        public string UserName { get; set; } = null!;
        public DateTime ExpiresAt { get; set; }
    }
}

namespace Attendance.Application.Dtos.SecondaryPasswords
{
    // Never returns the hash/plaintext — just whether the caller has one registered, for the FE to
    // decide whether to show a "set up first" warning before opening the sign/approve modal.
    public class SecondaryPasswordStatusDto
    {
        public bool IsRegistered { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}

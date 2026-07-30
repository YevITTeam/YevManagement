using System;

namespace Attendance.Domain.Entities;

// Second-factor password each user registers themselves — required again on every sign/approve/reject
// action on an OT form (submit, approve, reject, including the email-token channel), on top of the
// JWT/token identity already in place. Hash-only, never the plaintext.
public partial class SecondaryPassword
{
    public int Id { get; set; }

    public string UserName { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public DateTime UpdatedAt { get; set; }
}

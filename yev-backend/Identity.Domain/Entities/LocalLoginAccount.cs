using System;

namespace Identity.Domain.Entities;

// Password login for people without a domain account; kept apart from TestLoginAccount, whose shared password must stay Development-only.
public class LocalLoginAccount
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public int PrefixId { get; set; }

    public string PasswordHash { get; set; } = null!;

    public bool MustChangePassword { get; set; }

    public int FailedLoginCount { get; set; }

    public DateTime? LockedUntil { get; set; }

    public DateTime PasswordChangedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public string? CreatedByUserName { get; set; }

    public virtual User User { get; set; } = null!;

    public virtual LocalAccountPrefix AccountPrefix { get; set; } = null!;
}

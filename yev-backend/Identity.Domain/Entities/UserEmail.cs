namespace Identity.Domain.Entities;

// One email address of a user, managed by admins. Exactly one row per user is primary and mirrored into
// User.Email; modules without a UserEmailModule override send to the primary address.
public class UserEmail
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string Email { get; set; } = null!;

    // UserEmailSource: where the address came from (AD at login, AD alias, Tanium device data, typed by admin).
    public int Source { get; set; }

    public bool IsPrimary { get; set; }

    // Free text, e.g. the device code a Tanium suggestion came from.
    public string? Note { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User User { get; set; } = null!;

    public virtual ICollection<UserEmailModule> Modules { get; set; } = new List<UserEmailModule>();
}

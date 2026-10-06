namespace Identity.Domain.Entities;

// Routes the mail of one module (Shared.Application.Helper.EmailModules) for one user to a specific
// UserEmail. At most one row per (UserId, ModuleCode). UserId is denormalized for that unique index and
// has no FK (the cascade comes through UserEmail).
public class UserEmailModule
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string ModuleCode { get; set; } = null!;

    public int UserEmailId { get; set; }

    public virtual UserEmail UserEmail { get; set; } = null!;
}

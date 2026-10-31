namespace Asset.Domain.Entities;

// 1 user = 1 Branch so the scan flow resolves it instead of letting users pick one.
// UserId is Identity.Users.Id (other DB, no FK); names are display snapshots.
public partial class ServerCheckAssignment
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string UserName { get; set; } = null!;

    public string? FullName { get; set; }

    public int BranchId { get; set; }

    public virtual Branch Branch { get; set; } = null!;
}

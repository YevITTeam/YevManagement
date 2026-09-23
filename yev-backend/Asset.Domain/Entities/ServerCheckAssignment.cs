namespace Asset.Domain.Entities;

// Which Branch (xưởng) a user is responsible for scanning in the daily server check
// (asset-module.md §1.21). 1 user = exactly 1 Branch (UserId unique) — the scan flow resolves the
// branch from this row instead of letting the user pick one, so a wrong-branch scan is impossible.
// UserId is Identity.Users.Id (different DB, so no FK); UserName/FullName are display snapshots.
public partial class ServerCheckAssignment
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string UserName { get; set; } = null!;

    public string? FullName { get; set; }

    public int BranchId { get; set; }

    public virtual Branch Branch { get; set; } = null!;
}

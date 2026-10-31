namespace Asset.Domain.Entities;

// 1 user = 1 Branch, separate from ServerCheckAssignment; unlike it, many users may share a Branch so they
// scan one session together. UserId is Identity.Users.Id (other DB, no FK); names are display snapshots.
public partial class InventoryAssignment
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string UserName { get; set; } = null!;

    public string? FullName { get; set; }

    public int BranchId { get; set; }

    public virtual Branch Branch { get; set; } = null!;
}

namespace Asset.Domain.Entities;

// Which Branch (xưởng) a user is responsible for inventory-scanning (asset-module.md §1.22). 1 user =
// exactly 1 Branch (UserId unique) — same shape as ServerCheckAssignment, but a SEPARATE table: kiểm kê
// và kiểm tra server hằng ngày là 2 tính năng độc lập dù cùng shape "user ↔ xưởng". Unlike ServerCheck,
// nhiều user khác nhau vẫn được gán CHUNG 1 Branch (không unique theo BranchId) — 1 xưởng có nhiều máy
// ở nhiều nơi, cần nhiều người cùng quét chung 1 phiên. UserId là Identity.Users.Id (khác DB, không
// FK); UserName/FullName là snapshot để hiển thị.
public partial class InventoryAssignment
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string UserName { get; set; } = null!;

    public string? FullName { get; set; }

    public int BranchId { get; set; }

    public virtual Branch Branch { get; set; } = null!;
}

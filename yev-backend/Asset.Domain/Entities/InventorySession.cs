using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

// 1 đợt kiểm kê thiết bị của 1 xưởng bằng quét mã (asset-module.md §1.22). Khác ServerCheckSession:
// KHÔNG unique theo ngày — 1 đợt có thể kéo dài nhiều ngày, nhiều user cùng được phân công xưởng đó
// quét chung 1 phiên (xem InventoryAssignment). Ràng buộc duy nhất: 1 xưởng không được có quá 1 phiên
// Status=InProgress cùng lúc (unique filtered index, xem AssetDbContext). Locked khi Status=Completed.
public partial class InventorySession
{
    public int Id { get; set; }

    public int BranchId { get; set; }

    public DateTime StartedAt { get; set; }

    public string StartedBy { get; set; } = null!;

    public DateTime? EndedAt { get; set; }

    public string? EndedBy { get; set; }

    public int Status { get; set; }

    public virtual Branch Branch { get; set; } = null!;

    public virtual ICollection<InventorySessionItem> Items { get; set; } = new List<InventorySessionItem>();
}

using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

// May span several days with several users; at most 1 InProgress session per branch (filtered unique index).
// Locked once Completed.
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

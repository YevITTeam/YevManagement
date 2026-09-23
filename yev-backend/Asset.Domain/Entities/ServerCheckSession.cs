using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

// 1 record per calendar day (CheckDate unique) a "scan session" was started for the daily server-room
// check via QR (see asset-module.md §2 for the full flow). Locked once EndedAt is set — no re-open.
public partial class ServerCheckSession
{
    public int Id { get; set; }

    public DateTime CheckDate { get; set; }

    public DateTime StartedAt { get; set; }

    public string StartedBy { get; set; } = null!;

    public DateTime? EndedAt { get; set; }

    public string? EndedBy { get; set; }

    public int Status { get; set; }

    // Added 2026-09-21 (asset-module.md §1.21): 1 session per day PER Branch. Nullable only because
    // sessions created before this column existed have no branch.
    public int? BranchId { get; set; }

    public virtual Branch? Branch { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<ServerCheckItem> Items { get; set; } = new List<ServerCheckItem>();

    public virtual ICollection<ServerCheckManualResult> ManualResults { get; set; } = new List<ServerCheckManualResult>();
}

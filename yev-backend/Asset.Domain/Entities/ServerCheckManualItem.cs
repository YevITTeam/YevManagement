using System.Collections.Generic;

namespace Asset.Domain.Entities;

// Master list of the 4 checklist columns on the paper form that are NOT tied to any scannable device
// (Tình trạng âm thanh/mùi/nhiệt độ, Network Factory, Network Server, Gởi nhận Mail) — seeded once by
// migration, confirmed manually at the end of every session (asset-module.md §2).
public partial class ServerCheckManualItem
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public int DisplayOrder { get; set; }

    // Added 2026-09-17: true for "Network - Factory"/"Network - Server" only — lets FE show the
    // "Kiểm tra network" ping button on those 2 items instead of matching on Name (fragile).
    public bool UsesNetworkPing { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<ServerCheckManualResult> Results { get; set; } = new List<ServerCheckManualResult>();
}

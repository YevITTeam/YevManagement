using System.Collections.Generic;

namespace Asset.Domain.Entities;

// Paper-form checklist columns not tied to a scannable device; seeded by migration, confirmed at each session end.
public partial class ServerCheckManualItem
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public int DisplayOrder { get; set; }

    // Flags the 2 network items for the FE ping button instead of matching on Name.
    public bool UsesNetworkPing { get; set; }

    // Staff tick OK/NG themselves (no device); reported in the paper form's dedicated air-conditioner column.
    public bool IsAirConditioner { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<ServerCheckManualResult> Results { get; set; } = new List<ServerCheckManualResult>();
}

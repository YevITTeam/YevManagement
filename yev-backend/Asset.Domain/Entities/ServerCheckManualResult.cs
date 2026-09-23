using System;

namespace Asset.Domain.Entities;

public partial class ServerCheckManualResult
{
    public int Id { get; set; }

    public int SessionId { get; set; }

    public int ManualItemId { get; set; }

    public int Status { get; set; }

    public string? Note { get; set; }

    public string ConfirmedBy { get; set; } = null!;

    public DateTime ConfirmedAt { get; set; }

    public virtual ServerCheckSession Session { get; set; } = null!;

    public virtual ServerCheckManualItem ManualItem { get; set; } = null!;
}

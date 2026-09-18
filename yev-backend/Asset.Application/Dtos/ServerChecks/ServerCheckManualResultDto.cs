using System;

namespace Asset.Application.Dtos.ServerChecks
{
    public class ServerCheckManualResultDto
    {
        public int ManualItemId { get; set; }
        public string ManualItemName { get; set; } = null!;
        public bool UsesNetworkPing { get; set; }
        public int Status { get; set; }
        public string StatusText { get; set; } = null!;
        public string? Note { get; set; }
        public string? ConfirmedBy { get; set; }
        public DateTime? ConfirmedAt { get; set; }
    }
}

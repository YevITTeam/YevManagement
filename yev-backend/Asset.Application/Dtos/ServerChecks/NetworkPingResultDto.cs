using System.Collections.Generic;

namespace Asset.Application.Dtos.ServerChecks
{
    public class NetworkPingResultDto
    {
        public int TotalCount { get; set; }
        public int ReachableCount { get; set; }
        public bool AllReachable { get; set; }
        public List<NetworkPingItemDto> Items { get; set; } = new();
    }
}

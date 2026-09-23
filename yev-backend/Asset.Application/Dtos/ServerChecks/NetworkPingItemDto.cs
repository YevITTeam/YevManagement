namespace Asset.Application.Dtos.ServerChecks
{
    public class NetworkPingItemDto
    {
        public string IpAddress { get; set; } = null!;
        public int DeviceId { get; set; }
        public string DeviceCode { get; set; } = null!;
        public string DeviceName { get; set; } = null!;
        public int Category { get; set; }
        public string CategoryText { get; set; } = null!;
        public bool Reachable { get; set; }
        public long? RoundtripMs { get; set; }
    }
}

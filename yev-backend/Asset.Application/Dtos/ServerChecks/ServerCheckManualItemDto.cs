namespace Asset.Application.Dtos.ServerChecks
{
    public class ServerCheckManualItemDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public int DisplayOrder { get; set; }
        public bool UsesNetworkPing { get; set; }
        public bool IsAirConditioner { get; set; }
    }
}

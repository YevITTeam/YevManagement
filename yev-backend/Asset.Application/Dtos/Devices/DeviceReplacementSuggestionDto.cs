namespace Asset.Application.Dtos.Devices
{
    // Suggests "which device will receive the transfer" for the "Transfer Device" screen
    // opened on an old device — see GET /api/Device/{id}/replacement-suggestion,
    // docs/asset-module.md.
    public class DeviceReplacementSuggestionDto
    {
        public int Id { get; set; }
        public string DeviceCode { get; set; } = null!;
        public string DeviceName { get; set; } = null!;
    }
}

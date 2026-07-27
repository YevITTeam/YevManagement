namespace Asset.Application.Dtos.Devices
{
    public class DeviceEmailDto
    {
        public int Id { get; set; }
        public string Email { get; set; } = null!;
        public string? Note { get; set; }
    }
}

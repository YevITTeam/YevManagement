namespace Asset.Application.Dtos.DeviceSoftwares
{
    public class SoftwarePickerDto
    {
        public int SoftwareId { get; set; }
        public string SoftwareCode { get; set; } = null!;
        public string SoftwareName { get; set; } = null!;
        public bool IsSelected { get; set; }
    }
}

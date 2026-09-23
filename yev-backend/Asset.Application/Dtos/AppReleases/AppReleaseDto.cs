namespace Asset.Application.Dtos.AppReleases
{
    public class AppReleaseDto
    {
        public int Id { get; set; }
        public int VersionCode { get; set; }
        public string VersionName { get; set; } = null!;
        public int MinVersionCode { get; set; }
        public string ApkUrl { get; set; } = null!;
        public string? Changelog { get; set; }
    }
}

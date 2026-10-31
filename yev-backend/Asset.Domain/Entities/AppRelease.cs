namespace Asset.Domain.Entities;

// "Latest" = !IsDeleted with max VersionCode; no IsLatest flag to avoid two sources of truth.
// ApkUrl is just a link (internal upload or external).
public partial class AppRelease
{
    public int Id { get; set; }

    public int VersionCode { get; set; }

    public string VersionName { get; set; } = null!;

    public int MinVersionCode { get; set; }

    public string ApkUrl { get; set; } = null!;

    public string? Changelog { get; set; }

    public bool IsDeleted { get; set; }
}

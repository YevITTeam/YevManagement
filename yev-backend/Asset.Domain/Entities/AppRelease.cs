namespace Asset.Domain.Entities;

// 1 bản phát hành app Flutter "YEV Scan". "Bản mới nhất" = !IsDeleted, VersionCode lớn nhất (không có
// cờ IsLatest riêng — tránh phải đồng bộ 2 nguồn sự thật). Không có upload file: ApkUrl chỉ là link dán
// tay (file .apk lưu ở nơi khác, vd Drive/hạ tầng nội bộ), xem asset-module.md §1.23.
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

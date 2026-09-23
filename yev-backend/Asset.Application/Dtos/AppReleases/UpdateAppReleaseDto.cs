using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.AppReleases
{
    public class UpdateAppReleaseDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Version code không được để trống")]
        public int VersionCode { get; set; }

        [Required(ErrorMessage = "Tên phiên bản không được để trống")]
        public string VersionName { get; set; } = null!;

        [Required(ErrorMessage = "Min version code không được để trống")]
        public int MinVersionCode { get; set; }

        [Required(ErrorMessage = "Link file APK không được để trống")]
        public string ApkUrl { get; set; } = null!;

        public string? Changelog { get; set; }
    }
}

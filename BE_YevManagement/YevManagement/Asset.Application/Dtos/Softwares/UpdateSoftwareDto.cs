using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.Softwares
{
    public class UpdateSoftwareDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Mã phần mềm không được để trống")]
        public string SoftwareCode { get; set; } = null!;

        [Required(ErrorMessage = "Tên phần mềm không được để trống")]
        public string SoftwareName { get; set; } = null!;

        public string? SoftwareType { get; set; }

        public string? Publisher { get; set; }

        public int? SoftwareQuantity { get; set; }

        public int? SoftwarePriority { get; set; }

        [Required(ErrorMessage = "Nhóm phần mềm không được để trống")]
        public int SoftwareGroupId { get; set; }
    }
}

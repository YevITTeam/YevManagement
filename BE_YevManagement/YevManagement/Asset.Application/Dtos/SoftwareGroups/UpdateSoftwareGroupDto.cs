using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.SoftwareGroups
{
    public class UpdateSoftwareGroupDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Mã nhóm phần mềm không được để trống")]
        public string GroupCode { get; set; } = null!;

        [Required(ErrorMessage = "Tên nhóm phần mềm không được để trống")]
        public string GroupName { get; set; } = null!;
    }
}

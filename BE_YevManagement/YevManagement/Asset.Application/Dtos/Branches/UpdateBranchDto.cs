using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.Branches
{
    public class UpdateBranchDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Mã chi nhánh không được để trống")]
        public string BranchCode { get; set; } = null!;

        [Required(ErrorMessage = "Tên chi nhánh không được để trống")]
        public string BranchName { get; set; } = null!;
    }
}

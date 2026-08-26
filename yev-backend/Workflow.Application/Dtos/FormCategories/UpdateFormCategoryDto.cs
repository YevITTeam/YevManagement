using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.FormCategories
{
    public class UpdateFormCategoryDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Mã danh mục không được để trống")]
        public string Code { get; set; } = null!;

        [Required(ErrorMessage = "Tên danh mục không được để trống")]
        public string NameVn { get; set; } = null!;

        public string? NameJp { get; set; }

        public int? OrgUnitId { get; set; }

        public int SortOrder { get; set; }
    }
}

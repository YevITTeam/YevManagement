using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.OrgUnits
{
    public class CreateOrgUnitDto
    {
        [Required(ErrorMessage = "Mã đơn vị không được để trống")]
        public string Code { get; set; } = null!;

        [Required(ErrorMessage = "Tên đơn vị không được để trống")]
        public string NameVn { get; set; } = null!;

        public string? NameJp { get; set; }

        [Required(ErrorMessage = "Cấp tổ chức không được để trống")]
        public int OrgLevelId { get; set; }

        public int? ParentId { get; set; }

        public int SortOrder { get; set; }

        public DateTime? ValidFrom { get; set; }

        public DateTime? ValidTo { get; set; }
    }
}

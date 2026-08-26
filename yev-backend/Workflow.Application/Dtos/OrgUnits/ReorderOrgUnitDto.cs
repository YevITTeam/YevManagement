using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.OrgUnits
{
    // Kéo-thả đổi vị trí/cha trong cây tổ chức — gửi nguyên danh sách item bị ảnh hưởng, mỗi item
    // là 1 dòng OrgUnit cần cập nhật lại SortOrder (và ParentId nếu đổi cha).
    public class ReorderOrgUnitDto
    {
        [Required]
        public List<ReorderOrgUnitItemDto> Items { get; set; } = new();
    }

    public class ReorderOrgUnitItemDto
    {
        [Required]
        public int Id { get; set; }

        public int? ParentId { get; set; }

        public int SortOrder { get; set; }
    }
}

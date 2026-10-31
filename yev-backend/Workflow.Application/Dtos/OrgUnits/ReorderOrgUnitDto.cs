using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.OrgUnits
{
    // Send every affected item; each updates SortOrder (and ParentId when the parent changes).
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

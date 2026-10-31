using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.EmployeeOrgUnits
{
    // Replaces the whole assignment list; send an empty array to clear it.
    public class ReplaceEmployeeOrgUnitsDto
    {
        [Required]
        public List<ReplaceEmployeeOrgUnitItemDto> Items { get; set; } = new();
    }

    public class ReplaceEmployeeOrgUnitItemDto
    {
        [Required]
        public int OrgUnitId { get; set; }

        public int? JobTitleId { get; set; }

        public bool IsPrimary { get; set; }

        public DateTime? ValidFrom { get; set; }

        public DateTime? ValidTo { get; set; }
    }
}

using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.OrgLevels
{
    // Array order = SortOrder; the first item is the default the FE pre-selects. Empty array clears all.
    public class ReplaceOrgLevelJobTitleSuggestionsDto
    {
        [Required]
        public List<int> JobTitleIds { get; set; } = new();
    }
}

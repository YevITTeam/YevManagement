using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.FormCategoryCoordinators
{
    // Replaces the whole list; send an empty array to clear it.
    public class ReplaceFormCategoryCoordinatorsDto
    {
        [Required]
        public List<int> EmployeeIds { get; set; } = new();
    }
}

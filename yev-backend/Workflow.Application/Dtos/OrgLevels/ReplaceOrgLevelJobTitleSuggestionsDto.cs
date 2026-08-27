using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.OrgLevels
{
    // Thay NGUYÊN danh sách chức danh gợi ý của 1 OrgLevel (PUT /OrgLevel/{id}/job-title-suggestions)
    // — mirror pattern ReplaceFormCategoryCoordinatorsDto. Thứ tự trong mảng = SortOrder (phần tử đầu
    // = gợi ý mặc định để FE pre-select). Gửi mảng rỗng để bỏ hết gợi ý.
    public class ReplaceOrgLevelJobTitleSuggestionsDto
    {
        [Required]
        public List<int> JobTitleIds { get; set; } = new();
    }
}

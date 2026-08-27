namespace Workflow.Domain.Entities;

// Gợi ý chức danh mặc định khi gán nhân sự vào 1 đơn vị thuộc cấp này (vd cấp "Xưởng" gợi ý
// "Trưởng xưởng") — CHỈ gợi ý (pre-select), không giới hạn cứng, người dùng vẫn chọn tự do toàn bộ
// JobTitles khác (workflow-module.md §10, chốt lúc thêm bảng này).
public partial class OrgLevelJobTitleSuggestion
{
    public int Id { get; set; }

    public int OrgLevelId { get; set; }

    public int JobTitleId { get; set; }

    // Thứ tự gợi ý — SortOrder=0 là giá trị pre-select mặc định ở FE.
    public int SortOrder { get; set; }

    public bool IsDeleted { get; set; }

    public virtual OrgLevel OrgLevel { get; set; } = null!;

    public virtual JobTitle JobTitle { get; set; } = null!;
}

using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// Nguồn dữ liệu cho ô nhập dạng chọn (workflow-module.md §3.2). Admin đăng ký sẵn, designer chỉ được
// chọn từ danh sách — không có đường nào để người thiết kế form tự nhập SQL.
public partial class FormDataSource
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string NameVn { get; set; } = null!;

    public string? NameJp { get; set; }

    public DataSourceKind SourceKind { get; set; }

    public string? ConnectionName { get; set; }

    public string? SqlText { get; set; }

    public string ValueColumn { get; set; } = null!;

    public string DisplayColumn { get; set; } = null!;

    public string? FilterJson { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<FormField> FormFields { get; set; } = new List<FormField>();
}

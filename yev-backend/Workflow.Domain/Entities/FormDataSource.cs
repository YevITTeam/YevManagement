using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// Registered by admins; designers can only pick from the list, never enter SQL themselves.
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

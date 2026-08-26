using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// Ô nhập, designer kéo-thả (workflow-module.md §3.2). FieldKey là khoá trong DataJson của
// WorkflowRequests (Pha 3) và là thứ FormRoutes/FormFieldConditions soi vào — UNIQUE theo
// (FormDefinitionId, FieldKey).
public partial class FormField
{
    public int Id { get; set; }

    public int FormDefinitionId { get; set; }

    public string FieldKey { get; set; } = null!;

    public string LabelVn { get; set; } = null!;

    public string? LabelJp { get; set; }

    public FieldDataType DataType { get; set; }

    public bool IsRequired { get; set; }

    public int SortOrder { get; set; }

    public int ColumnSpan { get; set; } = 1;

    public string? Placeholder { get; set; }

    public string? DefaultValue { get; set; }

    public string? OptionsJson { get; set; }

    public decimal? MinValue { get; set; }

    public decimal? MaxValue { get; set; }

    public int? MaxLength { get; set; }

    public string? HelpTextVn { get; set; }

    public int? FormDataSourceId { get; set; }

    public string? AutoNumberPattern { get; set; }

    public bool DefaultVisible { get; set; } = true;

    public bool IsReadOnly { get; set; }

    public bool IsDeleted { get; set; }

    public virtual FormDefinition FormDefinition { get; set; } = null!;

    public virtual FormDataSource? FormDataSource { get; set; }

    public virtual ICollection<FormFieldCondition> TargetOfConditions { get; set; } = new List<FormFieldCondition>();

    public virtual ICollection<FormFieldCondition> SourceOfConditions { get; set; } = new List<FormFieldCondition>();
}

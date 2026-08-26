using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.FormFields
{
    public class FormFieldDto
    {
        public int Id { get; set; }
        public int FormDefinitionId { get; set; }
        public string FieldKey { get; set; } = null!;
        public string LabelVn { get; set; } = null!;
        public string? LabelJp { get; set; }
        public FieldDataType DataType { get; set; }
        public bool IsRequired { get; set; }
        public int SortOrder { get; set; }
        public int ColumnSpan { get; set; }
        public string? Placeholder { get; set; }
        public string? DefaultValue { get; set; }
        public string? OptionsJson { get; set; }
        public decimal? MinValue { get; set; }
        public decimal? MaxValue { get; set; }
        public int? MaxLength { get; set; }
        public string? HelpTextVn { get; set; }
        public int? FormDataSourceId { get; set; }
        public string? FormDataSourceNameVn { get; set; }
        public string? AutoNumberPattern { get; set; }
        public bool DefaultVisible { get; set; }
        public bool IsReadOnly { get; set; }
    }
}

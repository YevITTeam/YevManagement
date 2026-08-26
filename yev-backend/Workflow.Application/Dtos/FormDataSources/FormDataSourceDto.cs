using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.FormDataSources
{
    public class FormDataSourceDto
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
    }
}

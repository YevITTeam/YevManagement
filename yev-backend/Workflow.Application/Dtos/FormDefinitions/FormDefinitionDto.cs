using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.FormDefinitions
{
    public class FormDefinitionDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string NameVn { get; set; } = null!;
        public string? NameJp { get; set; }
        public int FormCategoryId { get; set; }
        public string FormCategoryNameVn { get; set; } = null!;
        public string? Description { get; set; }
        public int Version { get; set; }
        public bool IsPublished { get; set; }
        public bool AllowAttachment { get; set; }
        public bool RequireAttachment { get; set; }
        public string CodePrefix { get; set; } = null!;
        public RouteConditionType RouteConditionType { get; set; }
        public string? RouteNumericFieldKey { get; set; }
        public string? RouteClassFieldKey { get; set; }
        public int CreatedByEmployeeId { get; set; }
        public string CreatedByEmployeeName { get; set; } = null!;
        public int? UpdatedByEmployeeId { get; set; }
        public string? UpdatedByEmployeeName { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}

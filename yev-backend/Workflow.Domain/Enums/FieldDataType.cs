namespace Workflow.Domain.Enums;

// workflow-module.md §4 — kiểu dữ liệu của 1 ô nhập trong FormFields.
public enum FieldDataType
{
    Text = 1,
    TextArea = 2,
    Number = 3,
    Decimal = 4,
    Date = 5,
    DateTime = 6,
    Time = 7,
    Dropdown = 8,
    Radio = 9,
    Checkbox = 10,
    MultiSelect = 11,
    Employee = 12,
    OrgUnit = 13,
    Label = 14
}

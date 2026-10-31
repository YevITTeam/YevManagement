namespace Workflow.Domain.Enums;

// SqlQuery is blocked by the Service until a read-only account, write-keyword filter and timeout exist.
public enum DataSourceKind
{
    Employees = 1,
    OrgUnits = 2,
    JobTitles = 3,
    SqlQuery = 4
}

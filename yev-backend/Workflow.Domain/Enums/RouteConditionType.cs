namespace Workflow.Domain.Enums;

// Immutable after creation: changing it would invalidate every configured FormRoute.
public enum RouteConditionType
{
    None = 0,
    NumericRange = 1,
    ClassValue = 2,
    Both = 3
}

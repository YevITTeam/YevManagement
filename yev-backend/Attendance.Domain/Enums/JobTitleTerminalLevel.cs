namespace Attendance.Domain.Enums;

// A JobTitle can be a "terminal" rank — one of the 3 fixed final approval levels an OtForm must
// reach (mirrors Attendance.Domain.Enums.ApprovalLevel.DepartmentManager/WorkshopManager/
// GeneralDirector). None = an ordinary rank that only participates as an intermediate step. At
// most 1 active JobTitle may hold each non-None value (enforced in JobTitleService).
public enum JobTitleTerminalLevel
{
    None = 0,
    DepartmentManager = 1,
    WorkshopManager = 2,
    GeneralDirector = 3
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LineStructureFixes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Follow-ups agreed after the normalisation: GT A for teamless lines, name/code fixes, CNM split, orphans placed.
            migrationBuilder.Sql(@"
-- Lines without a team (indirect lines) go to the workshop's GT A team until the owners fill the real one.
INSERT ProductionTeams (Code, NameVn, IsDeleted, WorkshopId)
SELECT DISTINCT N'GT A', NULL, 0, l.WorkshopId FROM ProductionLines l
WHERE l.IsDeleted = 0 AND l.TeamId IS NULL
    AND NOT EXISTS (SELECT 1 FROM ProductionTeams t WHERE t.WorkshopId = l.WorkshopId AND t.Code = N'GT A' AND t.IsDeleted = 0);
UPDATE l SET TeamId = t.Id FROM ProductionLines l JOIN ProductionTeams t ON t.WorkshopId = l.WorkshopId AND t.Code = N'GT A' AND t.IsDeleted = 0
WHERE l.IsDeleted = 0 AND l.TeamId IS NULL;

-- Groups whose HR name disagrees with their HR code (code: 1 + D/I = TT/GT + 1/2 = Green/Orange).
UPDATE gl SET ProductionLineId = l.Id FROM GroupLines gl JOIN Groups g ON g.Id = gl.GroupId
JOIN ProductionLines l ON l.WorkshopId = g.WorkshopId AND l.LineCode = N'BN-B2' AND l.IsDeleted = 0
WHERE g.GroupCode = N'1D1PRBNB2' AND g.IsDeleted = 0;
UPDATE Groups SET LineKind = N'GT' WHERE GroupCode = N'1I2PRB08' AND IsDeleted = 0;
UPDATE gl SET ShiftTeamId = s.Id FROM GroupLines gl JOIN Groups g ON g.Id = gl.GroupId
JOIN ProductionShiftTeams s ON s.Code = N'O' AND s.IsDeleted = 0
WHERE g.GroupCode = N'1I2QSA01' AND g.IsDeleted = 0;
UPDATE gl SET ProductionLineId = l.Id FROM GroupLines gl JOIN Groups g ON g.Id = gl.GroupId
JOIN ProductionLines l ON l.WorkshopId = g.WorkshopId AND l.LineCode = N'B8' AND l.IsDeleted = 0
WHERE g.GroupCode = N'1I2QSB08' AND g.IsDeleted = 0;

-- The CNM groups of one department each get their own line (copy of CNM), named after the group.
DECLARE @cnm TABLE (GroupId int, WorkshopId int, LineCode nvarchar(50), SourceLineId int);
INSERT @cnm SELECT g.Id, g.WorkshopId,
    LEFT(CASE WHEN COUNT(*) OVER (PARTITION BY g.WorkshopId, g.GroupNameVn) > 1 THEN g.GroupNameVn + N' ' + g.GroupCode ELSE g.GroupNameVn END, 50), l.Id
FROM Groups g JOIN GroupLines gl ON gl.GroupId = g.Id JOIN ProductionLines l ON l.Id = gl.ProductionLineId
WHERE g.IsDeleted = 0 AND l.LineCode = N'CNM' AND g.GroupCode IN (N'1P4PC', N'AP1', N'AP2', N'AP3', N'1P4PP');
INSERT ProductionLines (LineCode, TeamId, CongDoan, IsDeleted, WorkshopId, CdMae, SortCode, HasDirectStaff, HasIndirectStaff)
SELECT c.LineCode, s.TeamId, s.CongDoan, 0, c.WorkshopId, s.CdMae, NULL, s.HasDirectStaff, s.HasIndirectStaff
FROM @cnm c JOIN ProductionLines s ON s.Id = c.SourceLineId
WHERE NOT EXISTS (SELECT 1 FROM ProductionLines l WHERE l.WorkshopId = c.WorkshopId AND l.LineCode = c.LineCode AND l.IsDeleted = 0);
UPDATE gl SET ProductionLineId = l.Id FROM GroupLines gl JOIN @cnm c ON c.GroupId = gl.GroupId AND gl.ProductionLineId = c.SourceLineId
JOIN ProductionLines l ON l.WorkshopId = c.WorkshopId AND l.LineCode = c.LineCode AND l.IsDeleted = 0;

-- People with neither group nor management title go to the largest group of their department.
UPDATE e SET GroupId = x.GroupId, DepartmentId = NULL
FROM Employees e LEFT JOIN JobTitles j ON j.Id = e.JobTitleId
CROSS APPLY (SELECT TOP 1 g.Id GroupId FROM Groups g WHERE g.IsDeleted = 0 AND g.DepartmentId = e.DepartmentId
    ORDER BY (SELECT COUNT(*) FROM Employees m WHERE m.GroupId = g.Id AND m.IsDeleted = 0) DESC, g.Id) x
WHERE e.IsDeleted = 0 AND e.GroupId IS NULL AND e.DepartmentId IS NOT NULL AND ISNULL(j.TerminalLevel, 0) = 0;

-- Members follow their group's pairs and kind; team always follows the line.
UPDATE e SET ProductionLineId = p.ProductionLineId, ShiftTeamId = p.ShiftTeamId,
    CongDoan = CASE WHEN e.ProductionLineId = p.ProductionLineId THEN ISNULL(e.CongDoan, l.CongDoan) ELSE l.CongDoan END,
    TaskName = ISNULL(e.TaskName, CASE WHEN l.CongDoan = N'GT A' THEN N'Office' END)
FROM Employees e
CROSS APPLY (SELECT TOP 1 gl.ProductionLineId, gl.ShiftTeamId FROM GroupLines gl WHERE gl.GroupId = e.GroupId ORDER BY gl.Id) p
JOIN ProductionLines l ON l.Id = p.ProductionLineId
WHERE e.IsDeleted = 0 AND NOT EXISTS (SELECT 1 FROM GroupLines c WHERE c.GroupId = e.GroupId AND c.ProductionLineId = e.ProductionLineId AND c.ShiftTeamId = e.ShiftTeamId);
UPDATE e SET StaffKind = g.LineKind FROM Employees e JOIN Groups g ON g.Id = e.GroupId JOIN ProductionLines l ON l.Id = e.ProductionLineId
WHERE e.IsDeleted = 0 AND ISNULL(e.StaffKind, N'') <> g.LineKind
    AND ((g.LineKind = N'TT' AND l.HasDirectStaff = 1) OR (g.LineKind = N'GT' AND l.HasIndirectStaff = 1));
UPDATE e SET TeamId = l.TeamId FROM Employees e JOIN ProductionLines l ON l.Id = e.ProductionLineId WHERE ISNULL(e.TeamId, 0) <> ISNULL(l.TeamId, 0);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data-only; nothing to undo structurally.
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class GroupLinesForEveryone : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Every group covers at least one Line × Ca, and everyone in a group carries line data.
            migrationBuilder.Sql(@"
-- Groups whose name points at a catalog line (ones already seen on dev); the rest fall back to a line named after the group.
DECLARE @map TABLE (GroupCode nvarchar(50), LineCode nvarchar(50));
INSERT @map VALUES
(N'1A4AP', N'CNM'),
(N'1P4CK', N'KANBAN'),
(N'AP1', N'CNM'),
(N'AP2', N'CNM'),
(N'AP3', N'CNM'),
(N'1I4PKZA', N'KZ-A'),
(N'1I4PKZB', N'KZ-B'),
(N'1I4PKZM', N'KZ-M'),
(N'1I4PKM', N'KANBAN-MAE'),
(N'1D1PRBNA', N'BN-A'),
(N'1I1PRBNA1', N'BN-A1'),
(N'1D1PRBNA1', N'BN-A1'),
(N'1I2PRBNA1', N'BN-A1'),
(N'1D2PRBNA1', N'BN-A1'),
(N'1D1PRBNS', N'BN-S'),
(N'1D2PRBNS', N'BN-S'),
(N'1D1PRBNB', N'BN-B'),
(N'1P4PP', N'CNM'),
(N'1I2PRDBS', N'DBS'),
(N'1P4PC', N'CNM'),
(N'1I1PRBOS', N'OS'),
(N'1D1PRBOS', N'OS'),
(N'1I2PRBOS', N'OS'),
(N'1D2PRBOS', N'OS'),
(N'1P4PKTQM', N'TQM'),
(N'1I4PRTCA', N'TC'),
(N'1I1PRTCA', N'TCA'),
(N'1I2PRTCA', N'TCA'),
(N'1I1PRTCB', N'TCB'),
(N'1I2PRTCB', N'TCB'),
(N'1I2PRDBA1H', N'DBHT-A1'),
(N'1I2PRDBA2H', N'DBHT-A2'),
(N'1I1PRDBB1H', N'DBHT-B1'),
(N'1I2PRDBB1H', N'DBHT-B1'),
(N'1I1PRDBB2H', N'DBHT-B2'),
(N'1I2PRDBB2H', N'DBHT-B2'),
(N'1I1PRDBA1', N'DBA1'),
(N'1I2PRDBA1', N'DBA1'),
(N'1I2PRDBA2', N'DBA2'),
(N'1I1PRDBB1', N'DBB1'),
(N'1I2PRDBB1', N'DBB1'),
(N'1I1PRDBB2', N'DBB2'),
(N'1I2PRDBB2', N'DBB2'),
(N'1I1PRDBS', N'DBS'),
(N'1I4PS', N'SHIDO'),
(N'1I1QSDBA', N'DBA'),
(N'1I2QSDBA', N'DBA'),
(N'1I1QSDBB', N'DBB'),
(N'1I2QSDBB', N'DBB'),
(N'1I1QSALC', N'LC-A'),
(N'1D1QDALC', N'LC-A'),
(N'1I2QSALC', N'LC-A'),
(N'1D2QDALC', N'LC-A'),
(N'1D1QDLCB', N'LC-B'),
(N'1I2QSLCB', N'LC-B'),
(N'1D2QDLCB', N'LC-B'),
(N'1P4QKM', N'MAU'),
(N'1I1QSBOS', N'OS'),
(N'1I2QSBOS', N'OS'),
(N'1I1QSTCA', N'TCA'),
(N'1I2QSTCA', N'TCA'),
(N'1I1QSTCB', N'TCB'),
(N'1I2QSTCB', N'TCB'),
(N'1I1QSBLV', N'V'),
(N'1I4QU', N'KTNV'),
(N'1I3QT', N'Tenaoshi');

DECLARE @hc int = (SELECT TOP 1 Id FROM ProductionShiftTeams WHERE Code = N'HC' AND IsDeleted = 0 ORDER BY Id);
DECLARE @g TABLE (GroupId int PRIMARY KEY, WorkshopId int, DepartmentId int, Name nvarchar(255), NameKind nvarchar(20) NULL, ShiftId int, LineId int NULL);
INSERT @g (GroupId, WorkshopId, DepartmentId, Name, NameKind, ShiftId)
SELECT g.Id, g.WorkshopId, g.DepartmentId, g.GroupNameVn,
    CASE WHEN N' ' + REPLACE(g.GroupNameVn, N'-', N' ') + N' ' LIKE N'% TT %' THEN N'TT'
         WHEN N' ' + REPLACE(g.GroupNameVn, N'-', N' ') + N' ' LIKE N'% GT %' THEN N'GT' END,
    COALESCE(CASE WHEN g.GroupNameVn LIKE N'%GREEN%' THEN (SELECT TOP 1 Id FROM ProductionShiftTeams WHERE Code = N'G' AND IsDeleted = 0)
                  WHEN g.GroupNameVn LIKE N'%ORANGE%' THEN (SELECT TOP 1 Id FROM ProductionShiftTeams WHERE Code = N'O' AND IsDeleted = 0) END, @hc)
FROM Groups g WHERE g.IsDeleted = 0 AND NOT EXISTS (SELECT 1 FROM GroupLines gl WHERE gl.GroupId = g.Id);

UPDATE x SET LineId = l.Id FROM @g x JOIN Groups g ON g.Id = x.GroupId JOIN @map m ON m.GroupCode = g.GroupCode
JOIN ProductionLines l ON l.WorkshopId = x.WorkshopId AND l.LineCode = m.LineCode AND l.IsDeleted = 0
WHERE x.NameKind IS NULL OR (x.NameKind = N'TT' AND l.HasDirectStaff = 1) OR (x.NameKind = N'GT' AND l.HasIndirectStaff = 1);

-- Fallback: Line = group name, team GT A, C_doan GT A, flags from the name's TT/GT (GT when absent).
INSERT ProductionTeams (Code, NameVn, IsDeleted, WorkshopId)
SELECT DISTINCT N'GT A', NULL, 0, x.WorkshopId FROM @g x
WHERE x.LineId IS NULL AND NOT EXISTS (SELECT 1 FROM ProductionTeams t WHERE t.WorkshopId = x.WorkshopId AND t.Code = N'GT A' AND t.IsDeleted = 0);
INSERT ProductionLines (LineCode, TeamId, CongDoan, IsDeleted, WorkshopId, CdMae, SortCode, HasDirectStaff, HasIndirectStaff)
SELECT LEFT(x.Name, 50), (SELECT TOP 1 t.Id FROM ProductionTeams t WHERE t.WorkshopId = x.WorkshopId AND t.Code = N'GT A' AND t.IsDeleted = 0),
    N'GT A', 0, x.WorkshopId, NULL, NULL, MAX(CASE WHEN x.NameKind = N'TT' THEN 1 ELSE 0 END), MAX(CASE WHEN ISNULL(x.NameKind, N'GT') = N'GT' THEN 1 ELSE 0 END)
FROM @g x WHERE x.LineId IS NULL
    AND NOT EXISTS (SELECT 1 FROM ProductionLines l WHERE l.WorkshopId = x.WorkshopId AND l.LineCode = LEFT(x.Name, 50) AND l.IsDeleted = 0)
GROUP BY x.WorkshopId, LEFT(x.Name, 50);
UPDATE x SET LineId = l.Id FROM @g x JOIN ProductionLines l ON l.WorkshopId = x.WorkshopId AND l.LineCode = LEFT(x.Name, 50) AND l.IsDeleted = 0
WHERE x.LineId IS NULL;
UPDATE l SET HasDirectStaff = 1 FROM ProductionLines l JOIN @g x ON x.LineId = l.Id WHERE x.NameKind = N'TT';
UPDATE l SET HasIndirectStaff = 1 FROM ProductionLines l JOIN @g x ON x.LineId = l.Id WHERE ISNULL(x.NameKind, N'GT') = N'GT' AND l.CongDoan = N'GT A';

INSERT GroupLines (GroupId, ProductionLineId, ShiftTeamId) SELECT GroupId, LineId, ShiftId FROM @g WHERE LineId IS NOT NULL;
UPDATE g SET LineKind = x.NameKind FROM Groups g JOIN @g x ON x.GroupId = g.Id WHERE x.NameKind IS NOT NULL;

-- Groups still without TT/GT: the line's only kind, else the kind most of the department's line groups have.
UPDATE g SET LineKind = CASE WHEN l.HasDirectStaff = 1 AND l.HasIndirectStaff = 0 THEN N'TT' WHEN l.HasDirectStaff = 0 AND l.HasIndirectStaff = 1 THEN N'GT' END
FROM Groups g CROSS APPLY (SELECT TOP 1 pl.* FROM GroupLines gl JOIN ProductionLines pl ON pl.Id = gl.ProductionLineId WHERE gl.GroupId = g.Id) l
WHERE g.IsDeleted = 0 AND g.LineKind IS NULL;
UPDATE g SET LineKind = ISNULL((SELECT TOP 1 o.LineKind FROM Groups o WHERE o.IsDeleted = 0 AND o.DepartmentId = g.DepartmentId AND o.LineKind IS NOT NULL
        GROUP BY o.LineKind ORDER BY COUNT(*) DESC, o.LineKind DESC), N'TT')
FROM Groups g WHERE g.IsDeleted = 0 AND g.LineKind IS NULL AND EXISTS (SELECT 1 FROM GroupLines gl WHERE gl.GroupId = g.Id);

-- Everyone in a group gets its Line × Ca when they have none; Office for the group-named lines.
UPDATE e SET ProductionLineId = l.Id, ShiftTeamId = gl.ShiftTeamId, TeamId = l.TeamId,
    CongDoan = ISNULL(e.CongDoan, l.CongDoan), TaskName = ISNULL(e.TaskName, CASE WHEN l.CongDoan = N'GT A' THEN N'Office' END)
FROM Employees e JOIN Groups g ON g.Id = e.GroupId
CROSS APPLY (SELECT TOP 1 x.ProductionLineId, x.ShiftTeamId FROM GroupLines x WHERE x.GroupId = g.Id ORDER BY x.Id) gl
JOIN ProductionLines l ON l.Id = gl.ProductionLineId
WHERE e.IsDeleted = 0 AND e.ProductionLineId IS NULL;
UPDATE e SET StaffKind = COALESCE(
    CASE WHEN g.LineKind = N'TT' AND l.HasDirectStaff = 1 THEN N'TT' WHEN g.LineKind = N'GT' AND l.HasIndirectStaff = 1 THEN N'GT' END,
    CASE WHEN l.HasDirectStaff = 1 AND l.HasIndirectStaff = 0 THEN N'TT' WHEN l.HasDirectStaff = 0 AND l.HasIndirectStaff = 1 THEN N'GT' END)
FROM Employees e JOIN ProductionLines l ON l.Id = e.ProductionLineId LEFT JOIN Groups g ON g.Id = e.GroupId
WHERE e.IsDeleted = 0 AND e.StaffKind IS NULL;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data-only; nothing to undo structurally.
        }
    }
}

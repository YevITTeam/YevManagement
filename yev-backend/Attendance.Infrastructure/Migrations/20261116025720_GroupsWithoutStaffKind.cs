using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class GroupsWithoutStaffKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // One group per (workshop, department, Line × Ca): the TT twin (else the oldest) keeps the pair, the others hand over
            // its people; a group left without pairs gives all its people to the keeper and is soft-deleted.
            migrationBuilder.Sql(@"
WITH p AS (
    SELECT gl.Id AS GlId, g.Id AS GroupId, g.WorkshopId, g.DepartmentId, gl.ProductionLineId, gl.ShiftTeamId,
           ROW_NUMBER() OVER (PARTITION BY g.WorkshopId, g.DepartmentId, gl.ProductionLineId, gl.ShiftTeamId
                              ORDER BY CASE WHEN g.LineKind = 'TT' THEN 0 ELSE 1 END, g.Id) AS Rn
    FROM GroupLines gl JOIN Groups g ON g.Id = gl.GroupId
    WHERE g.IsDeleted = 0)
SELECT d.GlId, d.GroupId AS FromGroupId, k.GroupId AS ToGroupId, d.ProductionLineId, d.ShiftTeamId
INTO #Moves
FROM p d JOIN p k ON k.Rn = 1 AND k.WorkshopId = d.WorkshopId AND k.DepartmentId = d.DepartmentId
    AND k.ProductionLineId = d.ProductionLineId AND k.ShiftTeamId = d.ShiftTeamId
WHERE d.Rn > 1;

SELECT DISTINCT m.FromGroupId INTO #Emptied FROM #Moves m
WHERE NOT EXISTS (SELECT 1 FROM GroupLines gl WHERE gl.GroupId = m.FromGroupId AND gl.Id NOT IN (SELECT GlId FROM #Moves));

UPDATE e SET GroupId = m.ToGroupId
FROM Employees e JOIN #Moves m ON m.FromGroupId = e.GroupId
WHERE e.IsDeleted = 0
  AND ((e.ProductionLineId = m.ProductionLineId AND e.ShiftTeamId = m.ShiftTeamId) OR e.GroupId IN (SELECT FromGroupId FROM #Emptied));

DELETE gl FROM GroupLines gl JOIN #Moves m ON m.GlId = gl.Id;
UPDATE Groups SET IsDeleted = 1 WHERE Id IN (SELECT FromGroupId FROM #Emptied);
DROP TABLE #Moves;
DROP TABLE #Emptied;

UPDATE Groups SET GroupNameVn = RTRIM(LEFT(RTRIM(GroupNameVn), LEN(GroupNameVn) - 3))
WHERE IsDeleted = 0 AND (RTRIM(GroupNameVn) LIKE '% TT' OR RTRIM(GroupNameVn) LIKE '% GT');

UPDATE e SET StaffKind = t.StaffKind
FROM Employees e
JOIN Groups g ON g.Id = e.GroupId
JOIN ProductionTasks t ON t.WorkshopId = g.WorkshopId AND t.Code = e.TaskName AND t.IsDeleted = 0
WHERE e.IsDeleted = 0;
");

            migrationBuilder.DropIndex(
                name: "IX_Groups_GroupCode",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "HasDirectStaff",
                table: "ProductionLines");

            migrationBuilder.DropColumn(
                name: "HasIndirectStaff",
                table: "ProductionLines");

            migrationBuilder.DropColumn(
                name: "LineKind",
                table: "Groups");

            migrationBuilder.CreateIndex(
                name: "IX_Groups_GroupCode",
                table: "Groups",
                column: "GroupCode",
                unique: true,
                filter: "[IsDeleted] = 0");

            // Mã nhóm = {Phòng}-{Line}-{Ca} of the first pair, -{Xưởng} added on a clash (GroupLineDefaults.AssignCodeAsync).
            migrationBuilder.Sql(@"
WITH c AS (
    SELECT g.Id, LEFT(d.DepartmentCode + '-' + l.LineCode + '-' + st.Code, 50) AS Base, w.WorkshopCode
    FROM Groups g
    JOIN Departments d ON d.Id = g.DepartmentId
    JOIN Workshops w ON w.Id = g.WorkshopId
    CROSS APPLY (SELECT TOP 1 gl.ProductionLineId, gl.ShiftTeamId FROM GroupLines gl WHERE gl.GroupId = g.Id ORDER BY gl.Id) f
    JOIN ProductionLines l ON l.Id = f.ProductionLineId
    JOIN ProductionShiftTeams st ON st.Id = f.ShiftTeamId
    WHERE g.IsDeleted = 0),
r AS (SELECT c.*, ROW_NUMBER() OVER (PARTITION BY Base ORDER BY Id) AS Rn FROM c)
UPDATE g SET GroupCode = CASE WHEN r.Rn = 1 THEN r.Base ELSE LEFT(r.Base + '-' + r.WorkshopCode, 50) END
FROM Groups g JOIN r ON r.Id = g.Id;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Groups_GroupCode",
                table: "Groups");

            migrationBuilder.AddColumn<bool>(
                name: "HasDirectStaff",
                table: "ProductionLines",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "HasIndirectStaff",
                table: "ProductionLines",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "LineKind",
                table: "Groups",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Groups_GroupCode",
                table: "Groups",
                column: "GroupCode",
                unique: true);
        }
    }
}

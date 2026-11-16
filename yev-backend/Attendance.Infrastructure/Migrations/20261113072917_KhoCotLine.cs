using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class KhoCotLine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Kho NVL and Kho COT are different warehouses, but the catalog has a single KHO line; COT gets its own.
            migrationBuilder.Sql(@"
DECLARE @g TABLE (GroupId int, WorkshopId int, SourceLineId int);
INSERT @g SELECT g.Id, g.WorkshopId, l.Id FROM Groups g JOIN GroupLines gl ON gl.GroupId = g.Id JOIN ProductionLines l ON l.Id = gl.ProductionLineId
WHERE g.IsDeleted = 0 AND l.LineCode = N'KHO' AND g.GroupNameVn LIKE N'%Kho COT%';
INSERT ProductionLines (LineCode, TeamId, CongDoan, IsDeleted, WorkshopId, CdMae, SortCode, HasDirectStaff, HasIndirectStaff)
SELECT DISTINCT N'KHO-COT', s.TeamId, s.CongDoan, 0, x.WorkshopId, s.CdMae, N'KHO-COT', s.HasDirectStaff, s.HasIndirectStaff
FROM @g x JOIN ProductionLines s ON s.Id = x.SourceLineId
WHERE NOT EXISTS (SELECT 1 FROM ProductionLines l WHERE l.WorkshopId = x.WorkshopId AND l.LineCode = N'KHO-COT' AND l.IsDeleted = 0);
UPDATE gl SET ProductionLineId = l.Id FROM GroupLines gl JOIN @g x ON x.GroupId = gl.GroupId AND gl.ProductionLineId = x.SourceLineId
JOIN ProductionLines l ON l.WorkshopId = x.WorkshopId AND l.LineCode = N'KHO-COT' AND l.IsDeleted = 0;
UPDATE e SET ProductionLineId = gl.ProductionLineId, TeamId = l.TeamId, CongDoan = l.CongDoan
FROM Employees e JOIN @g x ON x.GroupId = e.GroupId JOIN GroupLines gl ON gl.GroupId = e.GroupId AND gl.ShiftTeamId = e.ShiftTeamId
JOIN ProductionLines l ON l.Id = gl.ProductionLineId
WHERE e.IsDeleted = 0 AND e.ProductionLineId = x.SourceLineId;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data-only; nothing to undo structurally.
        }
    }
}

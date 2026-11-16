using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class GroupLineKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Groups_LineShift",
                table: "Groups");

            migrationBuilder.AddColumn<string>(
                name: "LineKind",
                table: "Groups",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Groups_ProductionLineId",
                table: "Groups",
                column: "ProductionLineId");

            // Backfill from names like "LINE A01 - GREEN TT" / "Block E Orange GT"; groups whose name gives no single line and colour stay empty for Admin.
            migrationBuilder.Sql(@"
WITH g AS (
    SELECT Id,
        ' ' + REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            UPPER(GroupNameVn), '-', ' '), '_', ' '), '.', ' '), N'·', ' '), '(', ' '), ')', ' '),
            '   ', ' '), '  ', ' '), '  ', ' '), 'LINE A0', 'LINE A'), 'LINE B0', 'LINE B') + ' ' AS n
    FROM Groups WHERE IsDeleted = 0 AND ProductionLineId IS NULL
), m AS (
    SELECT g.Id, l.Id AS LineId, RANK() OVER (PARTITION BY g.Id ORDER BY LEN(l.LineCode) DESC) AS rk
    FROM g JOIN ProductionLines l ON l.IsDeleted = 0
    CROSS APPLY (SELECT ' ' + REPLACE(REPLACE(UPPER(LTRIM(RTRIM(l.LineCode))), '-', ' '), '_', ' ') + ' ' AS t) tok
    WHERE g.n LIKE '% LINE' + tok.t + '%' OR g.n LIKE '% BLOCK' + tok.t + '%'
       OR (LEN(LTRIM(RTRIM(l.LineCode))) >= 3 AND g.n LIKE '%' + tok.t + '%')
), one AS (
    SELECT Id, MIN(LineId) AS LineId FROM m WHERE rk = 1 GROUP BY Id HAVING COUNT(*) = 1
), parsed AS (
    SELECT g.Id, one.LineId,
        CASE WHEN g.n LIKE '% GREEN %' THEN 'G' WHEN g.n LIKE '% ORANGE %' THEN 'O' END AS Ca,
        CASE WHEN g.n LIKE '% GT %' THEN 'GT' WHEN g.n LIKE '% TT %' THEN 'TT' END AS Kind
    FROM g JOIN one ON one.Id = g.Id
)
UPDATE gr SET ProductionLineId = p.LineId, ShiftTeamId = s.Id, LineKind = p.Kind
FROM Groups gr
JOIN parsed p ON p.Id = gr.Id
JOIN ProductionShiftTeams s ON s.IsDeleted = 0 AND LTRIM(RTRIM(s.Code)) = p.Ca;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Groups_ProductionLineId",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "LineKind",
                table: "Groups");

            migrationBuilder.CreateIndex(
                name: "IX_Groups_LineShift",
                table: "Groups",
                columns: new[] { "ProductionLineId", "ShiftTeamId" },
                unique: true,
                filter: "[ProductionLineId] IS NOT NULL AND [IsDeleted] = 0");
        }
    }
}

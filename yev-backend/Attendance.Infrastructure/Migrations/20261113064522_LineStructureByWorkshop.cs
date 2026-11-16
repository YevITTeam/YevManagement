using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LineStructureByWorkshop : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // WorkshopId starts nullable so the data step can fill it before it becomes required.
            migrationBuilder.AddColumn<int>(name: "WorkshopId", table: "ProductionTeams", type: "int", nullable: true);
            migrationBuilder.AddColumn<int>(name: "WorkshopId", table: "ProductionLines", type: "int", nullable: true);
            migrationBuilder.AlterColumn<int>(name: "TeamId", table: "ProductionLines", type: "int", nullable: true, oldClrType: typeof(int), oldType: "int");
            migrationBuilder.AddColumn<string>(name: "CdMae", table: "ProductionLines", type: "nvarchar(50)", maxLength: 50, nullable: true);
            migrationBuilder.AddColumn<string>(name: "SortCode", table: "ProductionLines", type: "nvarchar(50)", maxLength: 50, nullable: true);
            migrationBuilder.AddColumn<bool>(name: "HasDirectStaff", table: "ProductionLines", type: "bit", nullable: false, defaultValue: false);
            migrationBuilder.AddColumn<bool>(name: "HasIndirectStaff", table: "ProductionLines", type: "bit", nullable: false, defaultValue: false);
            migrationBuilder.AddColumn<string>(name: "StaffKind", table: "Employees", type: "nvarchar(20)", maxLength: 20, nullable: true);

            migrationBuilder.CreateTable(
                name: "GroupLines",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GroupId = table.Column<int>(type: "int", nullable: false),
                    ProductionLineId = table.Column<int>(type: "int", nullable: false),
                    ShiftTeamId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GroupLines_Groups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "Groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GroupLines_ProductionLines_ProductionLineId",
                        column: x => x.ProductionLineId,
                        principalTable: "ProductionLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GroupLines_ProductionShiftTeams_ShiftTeamId",
                        column: x => x.ShiftTeamId,
                        principalTable: "ProductionShiftTeams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            // Catalog normalised to docs/ot/Cau_Truc_Team_Line_Ca.xlsx (+ KTNV, SHIPPING kept on request), groups' single Line × Ca moved to GroupLines,
            // TT/GT inferred from the line's flags or the group's kind.
            migrationBuilder.Sql(@"
DECLARE @da int = (SELECT TOP 1 Id FROM Workshops WHERE WorkshopCode = N'DA' AND IsDeleted = 0 ORDER BY Id);
IF @da IS NULL SET @da = (SELECT MIN(Id) FROM Workshops WHERE IsDeleted = 0);
UPDATE ProductionTeams SET WorkshopId = @da;
UPDATE ProductionLines SET WorkshopId = @da;

DECLARE @src TABLE (Fac nvarchar(50), LineCode nvarchar(50), TeamCode nvarchar(20) NULL, CongDoan nvarchar(50) NULL,
    CdMae nvarchar(50) NULL, SortCode nvarchar(50) NULL, Tt bit, Gt bit);
INSERT @src VALUES
(N'DA', N'A1', N'1', N'ATO', N'C', N'A01', 1, 1),
(N'DA', N'A2', N'1', N'ATO', N'C', N'A02', 1, 1),
(N'DA', N'A3', N'1', N'ATO', N'C', N'A03', 1, 1),
(N'DA', N'A4', N'1', N'ATO', N'C', N'A04', 1, 1),
(N'DA', N'A5', N'1', N'ATO', N'F', N'A05', 1, 1),
(N'DA', N'A6', N'1', N'ATO', N'C', N'A06', 1, 1),
(N'DA', N'A7', N'1', N'ATO', N'F', N'A07', 1, 1),
(N'DA', N'A8', N'1', N'ATO', N'F', N'A08', 1, 1),
(N'DA', N'A9', N'1', N'ATO', N'E', N'A09', 1, 1),
(N'DA', N'A10', N'1', N'ATO', N'E', N'A10', 1, 1),
(N'DA', N'A100', N'4', N'ATO', N'HM-A', N'A100', 1, 1),
(N'DA', N'A11', N'1', N'ATO', N'E', N'A11', 1, 1),
(N'DA', N'A12', N'1', N'ATO', N'E', N'A12', 1, 1),
(N'DA', N'A15', N'1', N'ATO', N'E', N'A15', 1, 1),
(N'DA', N'A15-CELL', N'1', N'ATO', N'E', N'A15C', 1, 1),
(N'DA', N'A17', N'1', N'ATO', N'E', N'A17', 1, 1),
(N'DA', N'A18', N'1', N'ATO', N'E', N'A18', 1, 1),
(N'DA', N'A18-CELL', N'1', N'ATO', N'E', N'A18C', 1, 1),
(N'DA', N'B1', N'2', N'ATO', N'R', N'B01', 1, 1),
(N'DA', N'B2', N'2', N'ATO', N'R', N'B02', 1, 1),
(N'DA', N'B3', N'2', N'ATO', N'R', N'B03', 1, 1),
(N'DA', N'B4', N'2', N'ATO', N'R', N'B04', 1, 1),
(N'DA', N'B5', N'2', N'ATO', N'R', N'B05', 1, 1),
(N'DA', N'B6', N'2', N'ATO', N'R', N'B06', 1, 1),
(N'DA', N'B7', N'2', N'ATO', N'V', N'B07', 1, 1),
(N'DA', N'B8', N'2', N'ATO', N'V', N'B08', 1, 1),
(N'DA', N'B10', N'2', N'ATO', N'V', N'B10', 1, 1),
(N'DA', N'B100', N'4', N'ATO', N'HM-B', N'B100', 1, 1),
(N'DA', N'B11', N'2', N'ATO', N'V', N'B11', 1, 1),
(N'DA', N'B12', N'2', N'ATO', N'V', N'B12', 1, 1),
(N'DA', N'B13', N'2', N'ATO', N'V', N'B13', 1, 1),
(N'DA', N'B16', N'2', N'ATO', N'V', N'B16', 1, 1),
(N'DA', N'B17', N'2', N'ATO', N'V', N'B17', 1, 1),
(N'DA', N'B20', N'1', N'ATO', N'E', N'B20', 1, 1),
(N'DA', N'BN-A', N'1', N'ATO', NULL, N'BN-A', 1, 1),
(N'DA', N'BN-A1', N'1', N'ATO', NULL, N'BN-A1', 1, 1),
(N'DA', N'BN-A2', N'1', N'ATO', NULL, N'BN-A2', 1, 1),
(N'DA', N'BN-B', N'2', N'ATO', NULL, N'BN-B', 1, 1),
(N'DA', N'BN-B1', N'2', N'ATO', NULL, N'BN-B1', 1, 1),
(N'DA', N'BN-B2', N'2', N'ATO', NULL, N'BN-B2', 1, 1),
(N'DA', N'BN-S', N'1', N'ATO', NULL, N'BN-S', 1, 1),
(N'DA', N'C', N'1', N'MAE', NULL, N'C', 1, 1),
(N'DA', N'COTTING-MAE', N'Mini', N'MAE', NULL, N'COT-M', 1, 0),
(N'DA', N'COTTING-ATO', N'Mini', N'ATO', NULL, N'COT-A', 1, 0),
(N'DA', N'DA', N'2', N'MAE', N'JK', N'DA', 0, 1),
(N'DA', N'DBA', N'1', N'ATO', NULL, N'DBA', 0, 1),
(N'DA', N'DBA1', N'1', N'ATO', NULL, N'DBA1', 0, 1),
(N'DA', N'DBA2', N'1', N'ATO', NULL, N'DBA2', 0, 1),
(N'DA', N'DBB', N'2', N'ATO', NULL, N'DBB', 0, 1),
(N'DA', N'DBB1', N'2', N'ATO', NULL, N'DBB1', 0, 1),
(N'DA', N'DBB2', N'2', N'ATO', NULL, N'DBB2', 0, 1),
(N'DA', N'DBHT-A', N'1', N'ATO', NULL, N'DBHT-A', 0, 1),
(N'DA', N'DBHT-A1', N'1', N'ATO', NULL, N'DBHT-A1', 0, 1),
(N'DA', N'DBHT-A2', N'1', N'ATO', NULL, N'DBHT-A2', 0, 1),
(N'DA', N'DBHT-B', N'2', N'ATO', NULL, N'DBHT-B', 0, 1),
(N'DA', N'DBHT-B1', N'2', N'ATO', NULL, N'DBHT-B1', 0, 1),
(N'DA', N'DBHT-B2', N'2', N'ATO', NULL, N'DBHT-B2', 0, 1),
(N'DA', N'DBHT-S', N'1', N'ATO', NULL, N'DBHT-S', 0, 1),
(N'DA', N'DBS', N'1', N'ATO', NULL, N'DBS', 0, 1),
(N'DA', N'E', N'1', N'MAE', NULL, N'E', 1, 1),
(N'DA', N'F', N'1', N'MAE', NULL, N'F', 1, 1),
(N'DA', N'JK', N'2', N'MAE', NULL, N'JK', 1, 1),
(N'DA', N'JKC', N'1', N'MAE', N'E', N'JKC', 1, 1),
(N'DA', N'JKE', N'1', N'MAE', N'E', N'JKE', 1, 1),
(N'DA', N'JKF', N'1', N'MAE', N'F', N'JKF', 1, 1),
(N'DA', N'JKR', N'2', N'MAE', N'R', N'JKR', 1, 1),
(N'DA', N'JKV', N'2', N'MAE', N'V', N'JKV', 1, 1),
(N'MP', N'MP-24', N'1', N'MAE', N'C', N'MP-24', 1, 1),
(N'MP', N'MP-3', N'1', N'MAE', N'C', N'MP-3', 1, 1),
(N'MP', N'MP-5', N'1', N'MAE', N'C', N'MP-5', 1, 1),
(N'DA', N'OS', N'2', N'MAE', NULL, N'OS', 1, 1),
(N'DA', N'R', N'2', N'MAE', NULL, N'R', 1, 1),
(N'DA', N'TKS', N'1', N'MAE', NULL, N'TKS', 1, 1),
(N'TV', N'TV-5', N'2', N'MAE', N'JK', N'TV-5', 1, 1),
(N'TV', N'TV-A17', N'2', N'MAE', N'JK', N'TV-A17', 1, 1),
(N'TV', N'TV-A18', N'2', N'MAE', N'JK', N'TV-A18', 1, 1),
(N'DA', N'V', N'2', N'MAE', NULL, N'V', 1, 1),
(N'DA', N'HM-A', N'4', N'MAE', NULL, N'HM-A', 1, 1),
(N'DA', N'HM-B', N'4', N'MAE', NULL, N'HM-B', 1, 1),
(N'DA', N'BO-A', N'4', N'MAE', NULL, N'BO-A', 1, 1),
(N'DA', N'BO-B', N'4', N'MAE', NULL, N'BO-B', 1, 1),
(N'DA', N'A200', N'4', N'ATO', N'BO-A', N'A200', 1, 1),
(N'DA', N'B200', N'4', N'ATO', N'BO-B', N'B200', 1, 1),
(N'DA', N'DHCL', NULL, N'ATO', NULL, N'DHCL', 0, 1),
(N'DA', N'CNM', NULL, N'GT AB', NULL, N'CNM', 0, 1),
(N'DA', N'CNM_A', NULL, N'GT AB', NULL, N'CNM_A', 0, 1),
(N'DA', N'CNM_M', NULL, N'GT AB', NULL, N'CNM_M', 0, 1),
(N'DA', N'CNM-KSU-A', NULL, N'GT AB', NULL, N'CNM-KSU-A', 0, 1),
(N'DA', N'CNM-KSU-B', NULL, N'GT AB', NULL, N'CNM-KSU-B', 0, 1),
(N'DA', N'CNM-KSU-M', NULL, N'GT AB', NULL, N'CNM-KSU-M', 0, 1),
(N'DA', N'ĐN-A', NULL, N'GT AB', NULL, N'ĐN-A', 0, 1),
(N'DA', N'ĐN-B', NULL, N'GT AB', NULL, N'ĐN-B', 0, 1),
(N'DA', N'ĐN-S', NULL, N'GT AB', NULL, N'ĐN-S', 0, 1),
(N'DA', N'HL', NULL, N'GT AB', NULL, N'HL', 0, 1),
(N'DA', N'HL1', NULL, N'GT AB', NULL, N'HL1', 0, 1),
(N'DA', N'JAPAN', NULL, N'GT AB', NULL, N'JAPAN', 0, 1),
(N'DA', N'KHO', N'Mini', N'GT AB', NULL, N'KHO', 0, 1),
(N'DA', N'KSU', NULL, N'GT AB', NULL, N'KSU', 0, 1),
(N'DA', N'LC-A', NULL, N'GT AB', NULL, N'LC-A', 0, 1),
(N'DA', N'LC-B', NULL, N'GT AB', NULL, N'LC-B', 0, 1),
(N'DA', N'LD', NULL, N'GT AB', NULL, N'LD', 0, 1),
(N'DA', N'LQC-A', NULL, N'GT AB', NULL, N'LQC-A', 0, 1),
(N'DA', N'LQC-M', NULL, N'GT AB', NULL, N'LQC-M', 0, 1),
(N'DA', N'TC', NULL, N'GT AB', NULL, N'TC', 0, 1),
(N'DA', N'TCA', NULL, N'GT AB', NULL, N'TCA', 0, 1),
(N'DA', N'TCB', NULL, N'GT AB', NULL, N'TCB', 0, 1),
(N'DA', N'TCM', NULL, N'GT AB', NULL, N'TCM', 0, 1),
(N'DA', N'Tenaoshi', NULL, N'GT AB', NULL, N'Tenaoshi', 0, 1),
(N'DA', N'4S', NULL, N'GT B', NULL, N'4S', 0, 1),
(N'DA', N'KZ-A', NULL, N'GT B', NULL, N'APO-A', 0, 1),
(N'DA', N'KZ-B', NULL, N'GT B', NULL, N'APO-B', 0, 1),
(N'DA', N'KZ-M', NULL, N'GT B', NULL, N'APO-M', 0, 1),
(N'DA', N'CT', NULL, N'GT B', NULL, N'CT', 0, 1),
(N'DA', N'CTCD', NULL, N'GT B', NULL, N'CTCD', 0, 1),
(N'DA', N'KANBAN', NULL, N'GT B', NULL, N'KANBAN', 0, 1),
(N'DA', N'KANBAN-MAE', NULL, N'GT B', NULL, N'KANBAN-MAE', 0, 1),
(N'DA', N'KANBAN-NVL', N'Mini', N'GT B', NULL, N'KANBAN-NVL', 0, 1),
(N'DA', N'KZ', NULL, N'GT B', NULL, N'KZ', 0, 1),
(N'DA', N'MAU', NULL, N'GT B', NULL, N'MAU', 0, 1),
(N'DA', N'QA', NULL, N'GT B', NULL, N'QA', 0, 1),
(N'DA', N'SHIDO', NULL, N'GT B', NULL, N'SHIDO', 0, 1),
(N'DA', N'TQM', NULL, N'GT B', NULL, N'TQM', 0, 1),
(N'DA', N'KTNV', NULL, N'GT AB', NULL, N'KTNV', 0, 1),
(N'DA', N'SHIPPING', NULL, N'GT AB', NULL, N'SHIPPING', 0, 1);

INSERT ProductionTeams (Code, NameVn, IsDeleted, WorkshopId)
SELECT DISTINCT s.TeamCode, NULL, 0, w.Id FROM @src s JOIN Workshops w ON w.WorkshopCode = s.Fac AND w.IsDeleted = 0
WHERE s.TeamCode IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ProductionTeams t WHERE t.WorkshopId = w.Id AND t.Code = s.TeamCode AND t.IsDeleted = 0);

UPDATE l SET l.LineCode = s.LineCode, l.TeamId = t.Id, l.CongDoan = s.CongDoan, l.CdMae = s.CdMae, l.SortCode = s.SortCode,
    l.HasDirectStaff = s.Tt, l.HasIndirectStaff = s.Gt
FROM ProductionLines l JOIN Workshops w ON w.Id = l.WorkshopId JOIN @src s ON s.Fac = w.WorkshopCode AND s.LineCode = l.LineCode
LEFT JOIN ProductionTeams t ON t.WorkshopId = w.Id AND t.Code = s.TeamCode AND t.IsDeleted = 0
WHERE l.IsDeleted = 0;

INSERT ProductionLines (LineCode, TeamId, CongDoan, IsDeleted, WorkshopId, CdMae, SortCode, HasDirectStaff, HasIndirectStaff)
SELECT s.LineCode, t.Id, s.CongDoan, 0, w.Id, s.CdMae, s.SortCode, s.Tt, s.Gt
FROM @src s JOIN Workshops w ON w.WorkshopCode = s.Fac AND w.IsDeleted = 0
LEFT JOIN ProductionTeams t ON t.WorkshopId = w.Id AND t.Code = s.TeamCode AND t.IsDeleted = 0
WHERE NOT EXISTS (SELECT 1 FROM ProductionLines l WHERE l.WorkshopId = w.Id AND l.LineCode = s.LineCode AND l.IsDeleted = 0);

-- Lines missing from the file are retired unless someone still uses them.
UPDATE l SET IsDeleted = 1 FROM ProductionLines l JOIN Workshops w ON w.Id = l.WorkshopId
WHERE l.IsDeleted = 0 AND NOT EXISTS (SELECT 1 FROM @src s WHERE s.Fac = w.WorkshopCode AND s.LineCode = l.LineCode)
    AND NOT EXISTS (SELECT 1 FROM Employees e WHERE e.ProductionLineId = l.Id AND e.IsDeleted = 0)
    AND NOT EXISTS (SELECT 1 FROM Groups g WHERE g.ProductionLineId = l.Id AND g.IsDeleted = 0);
UPDATE l SET TeamId = NULL FROM ProductionLines l JOIN ProductionTeams t ON t.Id = l.TeamId
WHERE NOT EXISTS (SELECT 1 FROM @src s JOIN Workshops w ON w.WorkshopCode = s.Fac WHERE w.Id = t.WorkshopId AND s.TeamCode = t.Code);
UPDATE ProductionLines SET HasDirectStaff = 1, HasIndirectStaff = 1 WHERE IsDeleted = 0 AND HasDirectStaff = 0 AND HasIndirectStaff = 0;

UPDATE e SET TeamId = l.TeamId FROM Employees e JOIN ProductionLines l ON l.Id = e.ProductionLineId;
UPDATE Employees SET TeamId = NULL WHERE ProductionLineId IS NULL AND TeamId IS NOT NULL;
UPDATE t SET IsDeleted = 1 FROM ProductionTeams t WHERE t.IsDeleted = 0
    AND NOT EXISTS (SELECT 1 FROM @src s JOIN Workshops w ON w.WorkshopCode = s.Fac WHERE w.Id = t.WorkshopId AND s.TeamCode = t.Code);

INSERT GroupLines (GroupId, ProductionLineId, ShiftTeamId)
SELECT Id, ProductionLineId, ShiftTeamId FROM Groups WHERE IsDeleted = 0 AND ProductionLineId IS NOT NULL AND ShiftTeamId IS NOT NULL;
UPDATE g SET LineKind = CASE WHEN l.HasDirectStaff = 1 AND l.HasIndirectStaff = 0 THEN N'TT' WHEN l.HasDirectStaff = 0 AND l.HasIndirectStaff = 1 THEN N'GT' END
FROM Groups g JOIN ProductionLines l ON l.Id = g.ProductionLineId WHERE g.LineKind IS NULL AND g.IsDeleted = 0;

UPDATE e SET StaffKind = COALESCE(
    CASE WHEN l.HasDirectStaff = 1 AND l.HasIndirectStaff = 0 THEN N'TT' WHEN l.HasDirectStaff = 0 AND l.HasIndirectStaff = 1 THEN N'GT' END,
    CASE WHEN g.LineKind = N'TT' AND l.HasDirectStaff = 1 THEN N'TT' WHEN g.LineKind = N'GT' AND l.HasIndirectStaff = 1 THEN N'GT' END)
FROM Employees e JOIN ProductionLines l ON l.Id = e.ProductionLineId LEFT JOIN Groups g ON g.Id = e.GroupId;
");

            migrationBuilder.DropForeignKey(name: "FK_Groups_ProductionLines_ProductionLineId", table: "Groups");
            migrationBuilder.DropForeignKey(name: "FK_Groups_ProductionShiftTeams_ShiftTeamId", table: "Groups");
            migrationBuilder.DropIndex(name: "IX_Groups_ProductionLineId", table: "Groups");
            migrationBuilder.DropIndex(name: "IX_Groups_ShiftTeamId", table: "Groups");
            migrationBuilder.DropColumn(name: "ProductionLineId", table: "Groups");
            migrationBuilder.DropColumn(name: "ShiftTeamId", table: "Groups");

            migrationBuilder.AlterColumn<int>(name: "WorkshopId", table: "ProductionTeams", type: "int", nullable: false, oldClrType: typeof(int), oldType: "int", oldNullable: true);
            migrationBuilder.AlterColumn<int>(name: "WorkshopId", table: "ProductionLines", type: "int", nullable: false, oldClrType: typeof(int), oldType: "int", oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductionTeams_WorkshopId_Code",
                table: "ProductionTeams",
                columns: new[] { "WorkshopId", "Code" },
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionLines_WorkshopId_LineCode",
                table: "ProductionLines",
                columns: new[] { "WorkshopId", "LineCode" },
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_GroupLines_GroupId_ProductionLineId_ShiftTeamId",
                table: "GroupLines",
                columns: new[] { "GroupId", "ProductionLineId", "ShiftTeamId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GroupLines_ProductionLineId",
                table: "GroupLines",
                column: "ProductionLineId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupLines_ShiftTeamId",
                table: "GroupLines",
                column: "ShiftTeamId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionLines_Workshops_WorkshopId",
                table: "ProductionLines",
                column: "WorkshopId",
                principalTable: "Workshops",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionTeams_Workshops_WorkshopId",
                table: "ProductionTeams",
                column: "WorkshopId",
                principalTable: "Workshops",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProductionLines_Workshops_WorkshopId",
                table: "ProductionLines");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionTeams_Workshops_WorkshopId",
                table: "ProductionTeams");

            migrationBuilder.DropTable(
                name: "GroupLines");

            migrationBuilder.DropIndex(
                name: "IX_ProductionTeams_WorkshopId_Code",
                table: "ProductionTeams");

            migrationBuilder.DropIndex(
                name: "IX_ProductionLines_WorkshopId_LineCode",
                table: "ProductionLines");

            migrationBuilder.DropColumn(
                name: "WorkshopId",
                table: "ProductionTeams");

            migrationBuilder.DropColumn(
                name: "CdMae",
                table: "ProductionLines");

            migrationBuilder.DropColumn(
                name: "HasDirectStaff",
                table: "ProductionLines");

            migrationBuilder.DropColumn(
                name: "HasIndirectStaff",
                table: "ProductionLines");

            migrationBuilder.DropColumn(
                name: "SortCode",
                table: "ProductionLines");

            migrationBuilder.DropColumn(
                name: "WorkshopId",
                table: "ProductionLines");

            migrationBuilder.DropColumn(
                name: "StaffKind",
                table: "Employees");

            migrationBuilder.AlterColumn<int>(
                name: "TeamId",
                table: "ProductionLines",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProductionLineId",
                table: "Groups",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ShiftTeamId",
                table: "Groups",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Groups_ProductionLineId",
                table: "Groups",
                column: "ProductionLineId");

            migrationBuilder.CreateIndex(
                name: "IX_Groups_ShiftTeamId",
                table: "Groups",
                column: "ShiftTeamId");

            migrationBuilder.AddForeignKey(
                name: "FK_Groups_ProductionLines_ProductionLineId",
                table: "Groups",
                column: "ProductionLineId",
                principalTable: "ProductionLines",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Groups_ProductionShiftTeams_ShiftTeamId",
                table: "Groups",
                column: "ShiftTeamId",
                principalTable: "ProductionShiftTeams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}

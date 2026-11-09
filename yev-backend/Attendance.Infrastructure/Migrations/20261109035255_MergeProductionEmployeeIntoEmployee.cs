using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MergeProductionEmployeeIntoEmployee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CongDoan",
                table: "Employees",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsLineLeader",
                table: "Employees",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ProductionLineId",
                table: "Employees",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ShiftTeamId",
                table: "Employees",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TaskName",
                table: "Employees",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TeamId",
                table: "Employees",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Employees_ProductionLineId",
                table: "Employees",
                column: "ProductionLineId");

            migrationBuilder.CreateIndex(
                name: "IX_Employees_ShiftTeamId",
                table: "Employees",
                column: "ShiftTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_Employees_TeamId",
                table: "Employees",
                column: "TeamId");

            migrationBuilder.AddForeignKey(
                name: "FK_Employees_ProductionLines_ProductionLineId",
                table: "Employees",
                column: "ProductionLineId",
                principalTable: "ProductionLines",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Employees_ProductionShiftTeams_ShiftTeamId",
                table: "Employees",
                column: "ShiftTeamId",
                principalTable: "ProductionShiftTeams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Employees_ProductionTeams_TeamId",
                table: "Employees",
                column: "TeamId",
                principalTable: "ProductionTeams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // EXEC: in a generated script this shares a batch with ADD COLUMN, and a direct UPDATE would not compile.
            migrationBuilder.Sql(@"EXEC(N'
UPDATE e
SET e.ProductionLineId = p.ProductionLineId, e.TeamId = p.TeamId, e.ShiftTeamId = p.ShiftTeamId,
    e.CongDoan = p.CongDoan, e.TaskName = p.TaskName, e.IsLineLeader = p.IsLeader
FROM Employees e
JOIN ProductionEmployees p ON p.EmployeeId = e.Id
WHERE p.IsDeleted = 0;');");

            migrationBuilder.DropTable(
                name: "ProductionEmployees");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Employees_ProductionLines_ProductionLineId",
                table: "Employees");

            migrationBuilder.DropForeignKey(
                name: "FK_Employees_ProductionShiftTeams_ShiftTeamId",
                table: "Employees");

            migrationBuilder.DropForeignKey(
                name: "FK_Employees_ProductionTeams_TeamId",
                table: "Employees");

            migrationBuilder.DropIndex(
                name: "IX_Employees_ProductionLineId",
                table: "Employees");

            migrationBuilder.DropIndex(
                name: "IX_Employees_ShiftTeamId",
                table: "Employees");

            migrationBuilder.DropIndex(
                name: "IX_Employees_TeamId",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "CongDoan",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "IsLineLeader",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "ProductionLineId",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "ShiftTeamId",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "TaskName",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "TeamId",
                table: "Employees");

            migrationBuilder.CreateTable(
                name: "ProductionEmployees",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EmployeeId = table.Column<int>(type: "int", nullable: true),
                    ProductionLineId = table.Column<int>(type: "int", nullable: true),
                    ShiftTeamId = table.Column<int>(type: "int", nullable: true),
                    TeamId = table.Column<int>(type: "int", nullable: true),
                    BlockCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CongDoan = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    EmployeeCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    FirstNameSnapshot = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    IsLeader = table.Column<bool>(type: "bit", nullable: false),
                    LastNameSnapshot = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    ShiftTeamCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    TaskName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    TeamCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionEmployees", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductionEmployees_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductionEmployees_ProductionLines_ProductionLineId",
                        column: x => x.ProductionLineId,
                        principalTable: "ProductionLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductionEmployees_ProductionShiftTeams_ShiftTeamId",
                        column: x => x.ShiftTeamId,
                        principalTable: "ProductionShiftTeams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductionEmployees_ProductionTeams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "ProductionTeams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEmployees_EmployeeCode",
                table: "ProductionEmployees",
                column: "EmployeeCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEmployees_EmployeeId",
                table: "ProductionEmployees",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEmployees_ProductionLineId",
                table: "ProductionEmployees",
                column: "ProductionLineId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEmployees_ShiftTeamId",
                table: "ProductionEmployees",
                column: "ShiftTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEmployees_TeamId",
                table: "ProductionEmployees",
                column: "TeamId");
        }
    }
}

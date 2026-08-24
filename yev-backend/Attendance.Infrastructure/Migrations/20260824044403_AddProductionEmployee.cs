using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductionEmployee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProductionEmployees",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EmployeeCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    LastNameSnapshot = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    FirstNameSnapshot = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    CongDoan = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    TaskName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    BlockCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ProductionLineId = table.Column<int>(type: "int", nullable: true),
                    TeamCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    TeamId = table.Column<int>(type: "int", nullable: true),
                    ShiftTeamCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ShiftTeamId = table.Column<int>(type: "int", nullable: true),
                    IsLeader = table.Column<bool>(type: "bit", nullable: false),
                    EmployeeId = table.Column<int>(type: "int", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductionEmployees");
        }
    }
}

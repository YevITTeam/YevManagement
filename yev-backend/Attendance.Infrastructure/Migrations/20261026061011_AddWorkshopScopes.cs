using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkshopScopes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "WorkshopId",
                table: "OtForms",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WorkshopId",
                table: "OtFormBatches",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EmployeeApprovalScopes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EmployeeId = table.Column<int>(type: "int", nullable: false),
                    WorkshopId = table.Column<int>(type: "int", nullable: false),
                    DepartmentId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeApprovalScopes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmployeeApprovalScopes_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmployeeApprovalScopes_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EmployeeApprovalScopes_Workshops_WorkshopId",
                        column: x => x.WorkshopId,
                        principalTable: "Workshops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            // Existing data is all Dĩ An: forms follow their group's workshop (production forms have no group),
            // Department Managers get one (DA, department) scope, batches at the manager level get DA.
            migrationBuilder.Sql(@"
DECLARE @da INT = (SELECT Id FROM Workshops WHERE WorkshopCode = N'DA');
UPDATE f SET f.WorkshopId = g.WorkshopId FROM OtForms f INNER JOIN Groups g ON g.Id = f.GroupId;
UPDATE OtForms SET WorkshopId = @da WHERE WorkshopId IS NULL;
UPDATE OtFormBatches SET WorkshopId = @da WHERE DepartmentId IS NOT NULL;
INSERT INTO EmployeeApprovalScopes (EmployeeId, WorkshopId, DepartmentId)
SELECT e.Id, @da, e.DepartmentId FROM Employees e
INNER JOIN JobTitles j ON j.Id = e.JobTitleId
WHERE j.TerminalLevel = 1 AND e.DepartmentId IS NOT NULL AND e.IsDeleted = 0;");

            migrationBuilder.AlterColumn<int>(
                name: "WorkshopId",
                table: "OtForms",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_OtForms_WorkshopId",
                table: "OtForms",
                column: "WorkshopId");

            migrationBuilder.CreateIndex(
                name: "IX_OtFormBatches_WorkshopId",
                table: "OtFormBatches",
                column: "WorkshopId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeApprovalScopes_DepartmentId",
                table: "EmployeeApprovalScopes",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeApprovalScopes_Employee_Workshop_Department",
                table: "EmployeeApprovalScopes",
                columns: new[] { "EmployeeId", "WorkshopId", "DepartmentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeApprovalScopes_Workshop_Department",
                table: "EmployeeApprovalScopes",
                columns: new[] { "WorkshopId", "DepartmentId" });

            migrationBuilder.AddForeignKey(
                name: "FK_OtFormBatches_Workshops_WorkshopId",
                table: "OtFormBatches",
                column: "WorkshopId",
                principalTable: "Workshops",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_OtForms_Workshops_WorkshopId",
                table: "OtForms",
                column: "WorkshopId",
                principalTable: "Workshops",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OtFormBatches_Workshops_WorkshopId",
                table: "OtFormBatches");

            migrationBuilder.DropForeignKey(
                name: "FK_OtForms_Workshops_WorkshopId",
                table: "OtForms");

            migrationBuilder.DropTable(
                name: "EmployeeApprovalScopes");

            migrationBuilder.DropIndex(
                name: "IX_OtForms_WorkshopId",
                table: "OtForms");

            migrationBuilder.DropIndex(
                name: "IX_OtFormBatches_WorkshopId",
                table: "OtFormBatches");

            migrationBuilder.DropColumn(
                name: "WorkshopId",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "WorkshopId",
                table: "OtFormBatches");
        }
    }
}

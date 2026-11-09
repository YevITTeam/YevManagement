using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MergeOtFormCreatorsIntoBorrowedApprovers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 110892 is a test account whose grant is intentionally not carried over.
            migrationBuilder.Sql(@"
INSERT INTO GroupBorrowedApprovers (GroupId, EmployeeId)
SELECT c.GroupId, c.EmployeeId
FROM GroupOtFormCreators c
JOIN Employees e ON e.Id = c.EmployeeId
WHERE e.Code <> N'110892'
  AND NOT EXISTS (SELECT 1 FROM GroupBorrowedApprovers b WHERE b.GroupId = c.GroupId AND b.EmployeeId = c.EmployeeId);");

            migrationBuilder.DropTable(
                name: "GroupOtFormCreators");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GroupOtFormCreators",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EmployeeId = table.Column<int>(type: "int", nullable: false),
                    GroupId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupOtFormCreators", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GroupOtFormCreators_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GroupOtFormCreators_Groups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "Groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GroupOtFormCreators_EmployeeId",
                table: "GroupOtFormCreators",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupOtFormCreators_GroupId_EmployeeId",
                table: "GroupOtFormCreators",
                columns: new[] { "GroupId", "EmployeeId" },
                unique: true);
        }
    }
}

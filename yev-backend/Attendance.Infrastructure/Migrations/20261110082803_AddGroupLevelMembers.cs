using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupLevelMembers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ReceivesMail",
                table: "OtFormApprovalStepCandidates",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "CreatorMustSign",
                table: "Groups",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "GroupApprovalStepMembers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GroupApprovalStepId = table.Column<int>(type: "int", nullable: false),
                    EmployeeId = table.Column<int>(type: "int", nullable: false),
                    ReceivesMail = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupApprovalStepMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GroupApprovalStepMembers_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GroupApprovalStepMembers_GroupApprovalSteps_GroupApprovalStepId",
                        column: x => x.GroupApprovalStepId,
                        principalTable: "GroupApprovalSteps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GroupApprovalStepMembers_EmployeeId",
                table: "GroupApprovalStepMembers",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupApprovalStepMembers_GroupApprovalStepId_EmployeeId",
                table: "GroupApprovalStepMembers",
                columns: new[] { "GroupApprovalStepId", "EmployeeId" },
                unique: true);

            // Today's approvers become the levels' people, so the first day behaves as before.
            migrationBuilder.Sql(@"
INSERT INTO GroupApprovalStepMembers (GroupApprovalStepId, EmployeeId, ReceivesMail)
SELECT s.Id, e.Id, 1
FROM GroupApprovalSteps s
JOIN Employees e ON e.JobTitleId = s.JobTitleId
WHERE s.IsDeleted = 0 AND e.IsDeleted = 0 AND e.UserName IS NOT NULL
  AND (e.GroupId = s.GroupId
       OR EXISTS (SELECT 1 FROM GroupBorrowedApprovers b WHERE b.GroupId = s.GroupId AND b.EmployeeId = e.Id));");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GroupApprovalStepMembers");

            migrationBuilder.DropColumn(
                name: "ReceivesMail",
                table: "OtFormApprovalStepCandidates");

            migrationBuilder.DropColumn(
                name: "CreatorMustSign",
                table: "Groups");
        }
    }
}

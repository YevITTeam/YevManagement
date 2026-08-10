using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupApprovalStepRemoveDeptResponsible : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsResponsible",
                table: "DepartmentApprovalSteps");

            migrationBuilder.CreateTable(
                name: "GroupApprovalSteps",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GroupId = table.Column<int>(type: "int", nullable: false),
                    StepOrder = table.Column<int>(type: "int", nullable: false),
                    JobTitleId = table.Column<int>(type: "int", nullable: false),
                    RequiresSignature = table.Column<bool>(type: "bit", nullable: false),
                    IsResponsible = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupApprovalSteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GroupApprovalSteps_Groups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "Groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GroupApprovalSteps_JobTitles_JobTitleId",
                        column: x => x.JobTitleId,
                        principalTable: "JobTitles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GroupApprovalSteps_GroupId",
                table: "GroupApprovalSteps",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupApprovalSteps_JobTitleId",
                table: "GroupApprovalSteps",
                column: "JobTitleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GroupApprovalSteps");

            migrationBuilder.AddColumn<bool>(
                name: "IsResponsible",
                table: "DepartmentApprovalSteps",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }
    }
}

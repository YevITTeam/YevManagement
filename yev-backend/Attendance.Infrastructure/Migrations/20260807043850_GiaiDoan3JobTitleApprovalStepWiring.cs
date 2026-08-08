using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class GiaiDoan3JobTitleApprovalStepWiring : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "ApprovalLevel",
                table: "OtFormApprovalHistories",
                newName: "OtFormApprovalStepId");

            migrationBuilder.RenameColumn(
                name: "ApprovalLevel",
                table: "OtFormApprovalEmailTokens",
                newName: "OtFormApprovalStepId");

            migrationBuilder.AddColumn<string>(
                name: "ApprovalChainWarning",
                table: "OtForms",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "OtFormApprovalSteps",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OtFormId = table.Column<int>(type: "int", nullable: false),
                    StepOrder = table.Column<int>(type: "int", nullable: false),
                    JobTitleId = table.Column<int>(type: "int", nullable: false),
                    JobTitleCodeSnapshot = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    JobTitleNameSnapshot = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    RequiresSignatureSnapshot = table.Column<bool>(type: "bit", nullable: false),
                    IsResponsibleSnapshot = table.Column<bool>(type: "bit", nullable: false),
                    TerminalLevelSnapshot = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OtFormApprovalSteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OtFormApprovalSteps_JobTitles_JobTitleId",
                        column: x => x.JobTitleId,
                        principalTable: "JobTitles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OtFormApprovalSteps_OtForms_OtFormId",
                        column: x => x.OtFormId,
                        principalTable: "OtForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OtFormApprovalStepCandidates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OtFormApprovalStepId = table.Column<int>(type: "int", nullable: false),
                    EmployeeId = table.Column<int>(type: "int", nullable: false),
                    UserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OtFormApprovalStepCandidates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OtFormApprovalStepCandidates_OtFormApprovalSteps_OtFormApprovalStepId",
                        column: x => x.OtFormApprovalStepId,
                        principalTable: "OtFormApprovalSteps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OtFormApprovalHistories_OtFormApprovalStepId",
                table: "OtFormApprovalHistories",
                column: "OtFormApprovalStepId");

            migrationBuilder.CreateIndex(
                name: "IX_OtFormApprovalEmailTokens_OtFormApprovalStepId",
                table: "OtFormApprovalEmailTokens",
                column: "OtFormApprovalStepId");

            migrationBuilder.CreateIndex(
                name: "IX_OtFormApprovalStepCandidates_EmployeeId",
                table: "OtFormApprovalStepCandidates",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_OtFormApprovalStepCandidates_OtFormApprovalStepId",
                table: "OtFormApprovalStepCandidates",
                column: "OtFormApprovalStepId");

            migrationBuilder.CreateIndex(
                name: "IX_OtFormApprovalSteps_JobTitleId",
                table: "OtFormApprovalSteps",
                column: "JobTitleId");

            migrationBuilder.CreateIndex(
                name: "IX_OtFormApprovalSteps_OtFormId",
                table: "OtFormApprovalSteps",
                column: "OtFormId");

            migrationBuilder.AddForeignKey(
                name: "FK_OtFormApprovalEmailTokens_OtFormApprovalSteps_OtFormApprovalStepId",
                table: "OtFormApprovalEmailTokens",
                column: "OtFormApprovalStepId",
                principalTable: "OtFormApprovalSteps",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_OtFormApprovalHistories_OtFormApprovalSteps_OtFormApprovalStepId",
                table: "OtFormApprovalHistories",
                column: "OtFormApprovalStepId",
                principalTable: "OtFormApprovalSteps",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OtFormApprovalEmailTokens_OtFormApprovalSteps_OtFormApprovalStepId",
                table: "OtFormApprovalEmailTokens");

            migrationBuilder.DropForeignKey(
                name: "FK_OtFormApprovalHistories_OtFormApprovalSteps_OtFormApprovalStepId",
                table: "OtFormApprovalHistories");

            migrationBuilder.DropTable(
                name: "OtFormApprovalStepCandidates");

            migrationBuilder.DropTable(
                name: "OtFormApprovalSteps");

            migrationBuilder.DropIndex(
                name: "IX_OtFormApprovalHistories_OtFormApprovalStepId",
                table: "OtFormApprovalHistories");

            migrationBuilder.DropIndex(
                name: "IX_OtFormApprovalEmailTokens_OtFormApprovalStepId",
                table: "OtFormApprovalEmailTokens");

            migrationBuilder.DropColumn(
                name: "ApprovalChainWarning",
                table: "OtForms");

            migrationBuilder.RenameColumn(
                name: "OtFormApprovalStepId",
                table: "OtFormApprovalHistories",
                newName: "ApprovalLevel");

            migrationBuilder.RenameColumn(
                name: "OtFormApprovalStepId",
                table: "OtFormApprovalEmailTokens",
                newName: "ApprovalLevel");
        }
    }
}

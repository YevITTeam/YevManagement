using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFormRoutesAndApprovalSteps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FormRoutes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FormDefinitionId = table.Column<int>(type: "int", nullable: false),
                    NameVn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    NameJp = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    MinValue = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    MaxValue = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    ClassValue = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormRoutes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FormRoutes_FormDefinitions_FormDefinitionId",
                        column: x => x.FormDefinitionId,
                        principalTable: "FormDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FormApprovalSteps",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FormRouteId = table.Column<int>(type: "int", nullable: false),
                    StepOrder = table.Column<int>(type: "int", nullable: false),
                    NameVn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    NameJp = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    StepType = table.Column<int>(type: "int", nullable: false),
                    OrgUnitScope = table.Column<int>(type: "int", nullable: false),
                    OrgUnitId = table.Column<int>(type: "int", nullable: true),
                    ApproverMode = table.Column<int>(type: "int", nullable: false),
                    RequireSignature = table.Column<bool>(type: "bit", nullable: false),
                    AllowSendBack = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    AllowAddApprover = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormApprovalSteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FormApprovalSteps_FormRoutes_FormRouteId",
                        column: x => x.FormRouteId,
                        principalTable: "FormRoutes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FormApprovalSteps_OrgUnits_OrgUnitId",
                        column: x => x.OrgUnitId,
                        principalTable: "OrgUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FormApprovalStepParticipants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FormApprovalStepId = table.Column<int>(type: "int", nullable: false),
                    ParticipantSource = table.Column<int>(type: "int", nullable: false),
                    EmployeeId = table.Column<int>(type: "int", nullable: true),
                    JobTitleId = table.Column<int>(type: "int", nullable: true),
                    ParticipantRole = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormApprovalStepParticipants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FormApprovalStepParticipants_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FormApprovalStepParticipants_FormApprovalSteps_FormApprovalStepId",
                        column: x => x.FormApprovalStepId,
                        principalTable: "FormApprovalSteps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FormApprovalStepParticipants_JobTitles_JobTitleId",
                        column: x => x.JobTitleId,
                        principalTable: "JobTitles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FormApprovalStepParticipants_EmployeeId",
                table: "FormApprovalStepParticipants",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_FormApprovalStepParticipants_FormApprovalStepId_EmployeeId_JobTitleId",
                table: "FormApprovalStepParticipants",
                columns: new[] { "FormApprovalStepId", "EmployeeId", "JobTitleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FormApprovalStepParticipants_JobTitleId",
                table: "FormApprovalStepParticipants",
                column: "JobTitleId");

            migrationBuilder.CreateIndex(
                name: "IX_FormApprovalSteps_FormRouteId_StepOrder",
                table: "FormApprovalSteps",
                columns: new[] { "FormRouteId", "StepOrder" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FormApprovalSteps_OrgUnitId",
                table: "FormApprovalSteps",
                column: "OrgUnitId");

            migrationBuilder.CreateIndex(
                name: "IX_FormRoutes_FormDefinitionId_IsDefault_Filtered",
                table: "FormRoutes",
                column: "FormDefinitionId",
                unique: true,
                filter: "[IsDefault] = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FormApprovalStepParticipants");

            migrationBuilder.DropTable(
                name: "FormApprovalSteps");

            migrationBuilder.DropTable(
                name: "FormRoutes");
        }
    }
}

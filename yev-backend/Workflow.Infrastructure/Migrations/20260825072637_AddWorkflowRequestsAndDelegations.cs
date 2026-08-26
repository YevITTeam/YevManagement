using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowRequestsAndDelegations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ApprovalDelegations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DelegatorEmployeeId = table.Column<int>(type: "int", nullable: false),
                    DelegateEmployeeId = table.Column<int>(type: "int", nullable: false),
                    FormDefinitionId = table.Column<int>(type: "int", nullable: true),
                    FromDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ToDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApprovalDelegations", x => x.Id);
                    table.CheckConstraint("CK_ApprovalDelegations_DelegatorNotDelegate", "[DelegatorEmployeeId] <> [DelegateEmployeeId]");
                    table.ForeignKey(
                        name: "FK_ApprovalDelegations_Employees_DelegateEmployeeId",
                        column: x => x.DelegateEmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ApprovalDelegations_Employees_DelegatorEmployeeId",
                        column: x => x.DelegatorEmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ApprovalDelegations_FormDefinitions_FormDefinitionId",
                        column: x => x.FormDefinitionId,
                        principalTable: "FormDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "WorkflowRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RequestCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    FormDefinitionId = table.Column<int>(type: "int", nullable: false),
                    FormRouteId = table.Column<int>(type: "int", nullable: true),
                    RouteConditionSnapshot = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    FormVersion = table.Column<int>(type: "int", nullable: false),
                    DataJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FormSchemaJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CurrentStepOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedByEmployeeId = table.Column<int>(type: "int", nullable: false),
                    CreatedByOrgUnitId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkflowRequests_Employees_CreatedByEmployeeId",
                        column: x => x.CreatedByEmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkflowRequests_FormDefinitions_FormDefinitionId",
                        column: x => x.FormDefinitionId,
                        principalTable: "FormDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkflowRequests_FormRoutes_FormRouteId",
                        column: x => x.FormRouteId,
                        principalTable: "FormRoutes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkflowRequests_OrgUnits_CreatedByOrgUnitId",
                        column: x => x.CreatedByOrgUnitId,
                        principalTable: "OrgUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "WorkflowSequences",
                columns: table => new
                {
                    SequenceKey = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Year = table.Column<int>(type: "int", nullable: false),
                    LastSequence = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowSequences", x => new { x.SequenceKey, x.Year });
                });

            migrationBuilder.CreateTable(
                name: "WorkflowRequestHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WorkflowRequestId = table.Column<int>(type: "int", nullable: false),
                    StepOrder = table.Column<int>(type: "int", nullable: false),
                    ActorEmployeeId = table.Column<int>(type: "int", nullable: false),
                    OnBehalfOfEmployeeId = table.Column<int>(type: "int", nullable: true),
                    ActorNameSnapshot = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Action = table.Column<int>(type: "int", nullable: false),
                    SentBackToStepOrder = table.Column<int>(type: "int", nullable: true),
                    Comment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    SignatureImage = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    ActionAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowRequestHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkflowRequestHistories_Employees_ActorEmployeeId",
                        column: x => x.ActorEmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkflowRequestHistories_Employees_OnBehalfOfEmployeeId",
                        column: x => x.OnBehalfOfEmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkflowRequestHistories_WorkflowRequests_WorkflowRequestId",
                        column: x => x.WorkflowRequestId,
                        principalTable: "WorkflowRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkflowRequestSteps",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WorkflowRequestId = table.Column<int>(type: "int", nullable: false),
                    StepOrder = table.Column<int>(type: "int", nullable: false),
                    StepNameSnapshot = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    StepTypeSnapshot = table.Column<int>(type: "int", nullable: false),
                    OrgUnitNameSnapshot = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ApproverModeSnapshot = table.Column<int>(type: "int", nullable: false),
                    RequireSignatureSnapshot = table.Column<bool>(type: "bit", nullable: false),
                    AllowSendBackSnapshot = table.Column<bool>(type: "bit", nullable: false),
                    AllowAddApproverSnapshot = table.Column<bool>(type: "bit", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    IsAdHoc = table.Column<bool>(type: "bit", nullable: false),
                    InsertedByEmployeeId = table.Column<int>(type: "int", nullable: true),
                    ActedByEmployeeId = table.Column<int>(type: "int", nullable: true),
                    ActedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowRequestSteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkflowRequestSteps_Employees_ActedByEmployeeId",
                        column: x => x.ActedByEmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkflowRequestSteps_Employees_InsertedByEmployeeId",
                        column: x => x.InsertedByEmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkflowRequestSteps_WorkflowRequests_WorkflowRequestId",
                        column: x => x.WorkflowRequestId,
                        principalTable: "WorkflowRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkflowRequestStepParticipants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WorkflowRequestStepId = table.Column<int>(type: "int", nullable: false),
                    EmployeeId = table.Column<int>(type: "int", nullable: false),
                    ParticipantRole = table.Column<int>(type: "int", nullable: false),
                    ResolvedFromJobTitle = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ActedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowRequestStepParticipants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkflowRequestStepParticipants_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkflowRequestStepParticipants_WorkflowRequestSteps_WorkflowRequestStepId",
                        column: x => x.WorkflowRequestStepId,
                        principalTable: "WorkflowRequestSteps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalDelegations_DelegateEmployeeId_FromDate_ToDate",
                table: "ApprovalDelegations",
                columns: new[] { "DelegateEmployeeId", "FromDate", "ToDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalDelegations_DelegatorEmployeeId",
                table: "ApprovalDelegations",
                column: "DelegatorEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalDelegations_FormDefinitionId",
                table: "ApprovalDelegations",
                column: "FormDefinitionId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequestHistories_ActorEmployeeId",
                table: "WorkflowRequestHistories",
                column: "ActorEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequestHistories_OnBehalfOfEmployeeId",
                table: "WorkflowRequestHistories",
                column: "OnBehalfOfEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequestHistories_WorkflowRequestId_ActionAt",
                table: "WorkflowRequestHistories",
                columns: new[] { "WorkflowRequestId", "ActionAt" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequests_CreatedByEmployeeId_Status_CreatedAt",
                table: "WorkflowRequests",
                columns: new[] { "CreatedByEmployeeId", "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequests_CreatedByOrgUnitId",
                table: "WorkflowRequests",
                column: "CreatedByOrgUnitId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequests_FormDefinitionId_Status",
                table: "WorkflowRequests",
                columns: new[] { "FormDefinitionId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequests_FormRouteId",
                table: "WorkflowRequests",
                column: "FormRouteId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequests_RequestCode",
                table: "WorkflowRequests",
                column: "RequestCode",
                unique: true,
                filter: "[RequestCode] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequestStepParticipants_EmployeeId",
                table: "WorkflowRequestStepParticipants",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequestStepParticipants_WorkflowRequestStepId_EmployeeId",
                table: "WorkflowRequestStepParticipants",
                columns: new[] { "WorkflowRequestStepId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequestSteps_ActedByEmployeeId",
                table: "WorkflowRequestSteps",
                column: "ActedByEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequestSteps_InsertedByEmployeeId",
                table: "WorkflowRequestSteps",
                column: "InsertedByEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequestSteps_Status_WorkflowRequestId",
                table: "WorkflowRequestSteps",
                columns: new[] { "Status", "WorkflowRequestId" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequestSteps_WorkflowRequestId_StepOrder",
                table: "WorkflowRequestSteps",
                columns: new[] { "WorkflowRequestId", "StepOrder" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ApprovalDelegations");

            migrationBuilder.DropTable(
                name: "WorkflowRequestHistories");

            migrationBuilder.DropTable(
                name: "WorkflowRequestStepParticipants");

            migrationBuilder.DropTable(
                name: "WorkflowSequences");

            migrationBuilder.DropTable(
                name: "WorkflowRequestSteps");

            migrationBuilder.DropTable(
                name: "WorkflowRequests");
        }
    }
}

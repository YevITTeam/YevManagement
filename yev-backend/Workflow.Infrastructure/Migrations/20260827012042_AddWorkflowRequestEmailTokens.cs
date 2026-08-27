using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowRequestEmailTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WorkflowRequestEmailTokens",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WorkflowRequestId = table.Column<int>(type: "int", nullable: false),
                    StepOrder = table.Column<int>(type: "int", nullable: false),
                    ApproverEmployeeId = table.Column<int>(type: "int", nullable: false),
                    Token = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowRequestEmailTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkflowRequestEmailTokens_Employees_ApproverEmployeeId",
                        column: x => x.ApproverEmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkflowRequestEmailTokens_WorkflowRequests_WorkflowRequestId",
                        column: x => x.WorkflowRequestId,
                        principalTable: "WorkflowRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequestEmailTokens_ApproverEmployeeId",
                table: "WorkflowRequestEmailTokens",
                column: "ApproverEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequestEmailTokens_Token",
                table: "WorkflowRequestEmailTokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequestEmailTokens_WorkflowRequestId",
                table: "WorkflowRequestEmailTokens",
                column: "WorkflowRequestId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkflowRequestEmailTokens");
        }
    }
}

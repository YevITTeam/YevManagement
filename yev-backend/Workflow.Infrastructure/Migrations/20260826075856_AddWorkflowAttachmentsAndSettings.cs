using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowAttachmentsAndSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WorkflowAttachments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WorkflowRequestId = table.Column<int>(type: "int", nullable: false),
                    OriginalFileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    StoredFileName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    RelativePath = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    UploadedByEmployeeId = table.Column<int>(type: "int", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkflowAttachments_Employees_UploadedByEmployeeId",
                        column: x => x.UploadedByEmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkflowAttachments_WorkflowRequests_WorkflowRequestId",
                        column: x => x.WorkflowRequestId,
                        principalTable: "WorkflowRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkflowSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaxAttachmentSizeMb = table.Column<int>(type: "int", nullable: false),
                    AllowedFileExtensions = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    MaxAttachmentPerRequest = table.Column<int>(type: "int", nullable: false),
                    EmailTokenExpiryDays = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowAttachments_UploadedByEmployeeId",
                table: "WorkflowAttachments",
                column: "UploadedByEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowAttachments_WorkflowRequestId",
                table: "WorkflowAttachments",
                column: "WorkflowRequestId");

            // WorkflowSettings luôn đúng 1 dòng (workflow-module.md §3.4) — seed ngay khi tạo bảng để
            // WorkflowSettingService.GetAsync()/WorkflowRequestService (validate size/count/extension
            // đính kèm) không bao giờ gặp bảng rỗng. Không chỉ định Id: bảng vừa tạo, IDENTITY tự cấp 1.
            migrationBuilder.Sql(@"
INSERT INTO WorkflowSettings (MaxAttachmentSizeMb, AllowedFileExtensions, MaxAttachmentPerRequest, EmailTokenExpiryDays)
VALUES (10, N'.pdf,.jpg,.jpeg,.png,.docx,.xlsx', 5, 7);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkflowAttachments");

            migrationBuilder.DropTable(
                name: "WorkflowSettings");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOtFormBatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OtFormBatchId",
                table: "OtForms",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "OtFormBatches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DepartmentId = table.Column<int>(type: "int", nullable: false),
                    BatchDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ProcessedByUserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ProcessedByFullName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OtFormBatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OtFormBatches_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OtFormBatchEmailTokens",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OtFormBatchId = table.Column<int>(type: "int", nullable: false),
                    ApproverUserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ApproverFullName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    IsReminder = table.Column<bool>(type: "bit", nullable: false),
                    Token = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OtFormBatchEmailTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OtFormBatchEmailTokens_OtFormBatches_OtFormBatchId",
                        column: x => x.OtFormBatchId,
                        principalTable: "OtFormBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OtForms_OtFormBatchId",
                table: "OtForms",
                column: "OtFormBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_OtFormBatchEmailTokens_OtFormBatchId",
                table: "OtFormBatchEmailTokens",
                column: "OtFormBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_OtFormBatchEmailTokens_Token",
                table: "OtFormBatchEmailTokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OtFormBatches_DepartmentId",
                table: "OtFormBatches",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_OtFormBatches_Status",
                table: "OtFormBatches",
                column: "Status");

            migrationBuilder.AddForeignKey(
                name: "FK_OtForms_OtFormBatches_OtFormBatchId",
                table: "OtForms",
                column: "OtFormBatchId",
                principalTable: "OtFormBatches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OtForms_OtFormBatches_OtFormBatchId",
                table: "OtForms");

            migrationBuilder.DropTable(
                name: "OtFormBatchEmailTokens");

            migrationBuilder.DropTable(
                name: "OtFormBatches");

            migrationBuilder.DropIndex(
                name: "IX_OtForms_OtFormBatchId",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "OtFormBatchId",
                table: "OtForms");
        }
    }
}

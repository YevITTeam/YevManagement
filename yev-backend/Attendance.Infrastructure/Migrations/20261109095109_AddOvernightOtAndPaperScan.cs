using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOvernightOtAndPaperScan : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "LedgerHoursNextMonth",
                table: "OtFormEmployees",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsPaperApproval",
                table: "OtFormApprovalHistories",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "OtFormPaperScans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OtFormId = table.Column<int>(type: "int", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FileContent = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    UploadedByUserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UploadedByFullName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    ReviewedByUserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ReviewedByFullName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReviewComment = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OtFormPaperScans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OtFormPaperScans_OtForms_OtFormId",
                        column: x => x.OtFormId,
                        principalTable: "OtForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OtFormPaperScans_OtFormId",
                table: "OtFormPaperScans",
                column: "OtFormId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OtFormPaperScans");

            migrationBuilder.DropColumn(
                name: "LedgerHoursNextMonth",
                table: "OtFormEmployees");

            migrationBuilder.DropColumn(
                name: "IsPaperApproval",
                table: "OtFormApprovalHistories");
        }
    }
}

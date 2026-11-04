using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAttendanceAuditTrailAndMailLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AttendanceAuditTrails",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TableName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    RecordId = table.Column<int>(type: "int", nullable: false),
                    RecordName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    AffectedCount = table.Column<int>(type: "int", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    OldValues = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NewValues = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ChangedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttendanceAuditTrails", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AttendanceMailLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RecipientUserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ToEmail = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    Subject = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    LastError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    RequestedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttendanceMailLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceAuditTrails_ChangedAt",
                table: "AttendanceAuditTrails",
                column: "ChangedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceAuditTrails_TableName_RecordId",
                table: "AttendanceAuditTrails",
                columns: new[] { "TableName", "RecordId" });

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceMailLogs_CreatedAt",
                table: "AttendanceMailLogs",
                column: "CreatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AttendanceAuditTrails");

            migrationBuilder.DropTable(
                name: "AttendanceMailLogs");
        }
    }
}

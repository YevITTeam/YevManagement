using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOtResubmitAndBackdate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CanResubmit",
                table: "GroupApprovalSteps",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "BackdateDays",
                table: "AttendanceSettings",
                type: "int",
                nullable: false,
                defaultValue: 7);

            migrationBuilder.AddColumn<int>(
                name: "ResubmitWindowDays",
                table: "AttendanceSettings",
                type: "int",
                nullable: false,
                defaultValue: 3);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CanResubmit",
                table: "GroupApprovalSteps");

            migrationBuilder.DropColumn(
                name: "BackdateDays",
                table: "AttendanceSettings");

            migrationBuilder.DropColumn(
                name: "ResubmitWindowDays",
                table: "AttendanceSettings");
        }
    }
}

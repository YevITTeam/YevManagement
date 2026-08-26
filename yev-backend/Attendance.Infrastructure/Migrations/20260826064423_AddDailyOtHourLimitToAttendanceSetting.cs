using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDailyOtHourLimitToAttendanceSetting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "DailyOtHourLimit",
                table: "AttendanceSettings",
                type: "decimal(5,2)",
                nullable: false,
                defaultValue: 4m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DailyOtHourLimit",
                table: "AttendanceSettings");
        }
    }
}

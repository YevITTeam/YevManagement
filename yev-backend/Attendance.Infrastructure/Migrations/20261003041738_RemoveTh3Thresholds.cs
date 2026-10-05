using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveTh3Thresholds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Th3MonthlyOtHourLimit",
                table: "AttendanceSettings");

            migrationBuilder.DropColumn(
                name: "Th3YearlyOtHourLimit",
                table: "AttendanceSettings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Th3MonthlyOtHourLimit",
                table: "AttendanceSettings",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Th3YearlyOtHourLimit",
                table: "AttendanceSettings",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 0m);
        }
    }
}

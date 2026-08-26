using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeCustomOtHourLimit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CustomMonthlyOtHourLimit",
                table: "Employees",
                type: "decimal(10,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CustomYearlyOtHourLimit",
                table: "Employees",
                type: "decimal(10,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomMonthlyOtHourLimit",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "CustomYearlyOtHourLimit",
                table: "Employees");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SnapshotEmployeeOtHourLimitOnForm : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CustomMonthlyOtHourLimitSnapshot",
                table: "OtFormEmployees",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CustomYearlyOtHourLimitSnapshot",
                table: "OtFormEmployees",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            // Existing forms never stored it; today's personal limit is the closest value there is. EXEC: the columns are new in this batch.
            migrationBuilder.Sql(@"EXEC(N'
UPDATE fe SET CustomMonthlyOtHourLimitSnapshot = e.CustomMonthlyOtHourLimit, CustomYearlyOtHourLimitSnapshot = e.CustomYearlyOtHourLimit
FROM OtFormEmployees fe JOIN Employees e ON e.Id = fe.EmployeeId
WHERE e.CustomMonthlyOtHourLimit IS NOT NULL OR e.CustomYearlyOtHourLimit IS NOT NULL')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomMonthlyOtHourLimitSnapshot",
                table: "OtFormEmployees");

            migrationBuilder.DropColumn(
                name: "CustomYearlyOtHourLimitSnapshot",
                table: "OtFormEmployees");
        }
    }
}

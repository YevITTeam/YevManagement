using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeUserNameAccumulationAndOtFormCreatedByFullName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CreatedByFullName",
                table: "OtForms",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AccumulationMonth",
                table: "Employees",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "AccumulationYear",
                table: "Employees",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "UserName",
                table: "Employees",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            // Existing MonthToDate/YearToDate data (manually entered at setup time) must be treated as
            // "as of right now" — if left at the default 0/0, the first OtForm Completed in the
            // current month/year would be treated as a rollover by
            // OtFormService.AccumulateEmployeeHoursAsync and wipe them out.
            migrationBuilder.Sql("UPDATE Employees SET AccumulationYear = YEAR(GETUTCDATE()), AccumulationMonth = MONTH(GETUTCDATE())");

            migrationBuilder.CreateIndex(
                name: "IX_Employees_UserName",
                table: "Employees",
                column: "UserName",
                unique: true,
                filter: "[UserName] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Employees_UserName",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "CreatedByFullName",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "AccumulationMonth",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "AccumulationYear",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "UserName",
                table: "Employees");
        }
    }
}

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

            // Dữ liệu MonthToDate/YearToDate đã có sẵn (nhập tay lúc khởi tạo) phải được coi là "as of
            // ngay bây giờ" — nếu để mặc định 0/0 thì lần OtForm Completed đầu tiên trong tháng/năm
            // hiện tại sẽ bị OtFormService.AccumulateEmployeeHoursAsync coi là rollover và xóa mất.
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

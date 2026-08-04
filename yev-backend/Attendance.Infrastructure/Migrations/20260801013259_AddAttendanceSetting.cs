using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAttendanceSetting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AttendanceSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MainMealTicketMinHours = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    MonthlyOtHourLimit = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    YearlyOtHourLimit = table.Column<decimal>(type: "decimal(10,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttendanceSettings", x => x.Id);
                });

            // Seed đúng 1 dòng cấu hình — bảng này luôn chỉ có 1 dòng (xem AttendanceSettingService).
            // Giá trị mặc định phải KHỚP các hằng Default* trong AttendanceSettingService:
            //  - 2.5h  = mốc "tăng ca từ 2h30 mới có phiếu chính" (chốt với người dùng 2026-08-01);
            //  - 25h/tháng, 300h/năm = đúng 2 ngưỡng vốn đang hardcode ở FE trước đợt này, giữ nguyên
            //    để hành vi cảnh báo đỏ không đổi sau khi deploy.
            migrationBuilder.Sql(@"
INSERT INTO AttendanceSettings (MainMealTicketMinHours, MonthlyOtHourLimit, YearlyOtHourLimit)
VALUES (2.5, 25, 300);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AttendanceSettings");
        }
    }
}

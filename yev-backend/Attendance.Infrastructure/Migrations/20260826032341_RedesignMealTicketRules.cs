using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RedesignMealTicketRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // defaultValue backfill dòng cấu hình duy nhất đang có với đúng mặc định mới (6h-8h/0.5h/2h) —
            // xem AttendanceSettingService.DefaultEarlyMealWindow*/DefaultMealBreakDeductionHours/
            // DefaultNoMealTicketMaxHours.
            migrationBuilder.AddColumn<TimeOnly>(
                name: "EarlyMealWindowEndTime",
                table: "AttendanceSettings",
                type: "time",
                nullable: false,
                defaultValue: new TimeOnly(8, 0, 0));

            migrationBuilder.AddColumn<TimeOnly>(
                name: "EarlyMealWindowStartTime",
                table: "AttendanceSettings",
                type: "time",
                nullable: false,
                defaultValue: new TimeOnly(6, 0, 0));

            migrationBuilder.AddColumn<decimal>(
                name: "MealBreakDeductionHours",
                table: "AttendanceSettings",
                type: "decimal(5,2)",
                nullable: false,
                defaultValue: 0.5m);

            migrationBuilder.AddColumn<decimal>(
                name: "NoMealTicketMaxHours",
                table: "AttendanceSettings",
                type: "decimal(5,2)",
                nullable: false,
                defaultValue: 2m);

            // MainMealTicketMinHours đổi Ý NGHĨA (so trên thực tích thay vì giờ thô) — dòng cấu hình
            // live đang giữ giá trị 2 (mốc cũ) phải cập nhật sang mốc mới 3.5, không thì hệ thống vẫn
            // chạy nhưng SAI ngưỡng phiếu Chính ngay sau khi deploy (redesign 2026-08-26).
            migrationBuilder.Sql("UPDATE AttendanceSettings SET MainMealTicketMinHours = 3.5 WHERE MainMealTicketMinHours = 2;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE AttendanceSettings SET MainMealTicketMinHours = 2 WHERE MainMealTicketMinHours = 3.5;");

            migrationBuilder.DropColumn(
                name: "EarlyMealWindowEndTime",
                table: "AttendanceSettings");

            migrationBuilder.DropColumn(
                name: "EarlyMealWindowStartTime",
                table: "AttendanceSettings");

            migrationBuilder.DropColumn(
                name: "MealBreakDeductionHours",
                table: "AttendanceSettings");

            migrationBuilder.DropColumn(
                name: "NoMealTicketMaxHours",
                table: "AttendanceSettings");
        }
    }
}

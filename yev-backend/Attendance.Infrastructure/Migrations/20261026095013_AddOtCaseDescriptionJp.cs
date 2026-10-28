﻿using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOtCaseDescriptionJp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DescriptionJp",
                table: "OtCases",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            // Japanese text for the three default cases; only rows whose Vietnamese text is still the seeded one.
            migrationBuilder.Sql(@"
UPDATE OtCases SET DescriptionJp = N'平日の残業' WHERE Code = N'TH1' AND Description = N'Tăng ca ngày thường';
UPDATE OtCases SET DescriptionJp = N'祝日・日曜日の休日出勤' WHERE Code = N'TH2' AND Description = N'Nghỉ ngày lễ/ Chủ nhật';
UPDATE OtCases SET DescriptionJp = N'累計残業が月25時間・年300時間を超える場合' WHERE Code = N'TH3' AND Description = N'Trường hợp lũy kế tăng ca trên 25h/tháng, 300h/năm';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DescriptionJp",
                table: "OtCases");
        }
    }
}

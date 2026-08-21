using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOtFormCreatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // defaultValueSql (không phải defaultValue 01/01/0001) — đơn đã có sẵn trước migration này
            // (dữ liệu test hiện tại) nhận GETUTCDATE() làm CreatedAt hợp lý thay vì ngày trắng vô nghĩa.
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "OtForms",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "GETUTCDATE()");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "OtForms");
        }
    }
}

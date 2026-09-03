using System;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTestLoginAccounts : Migration
    {
        // Mật khẩu dùng chung cho cả 6 tài khoản TEST (2026-08-28, theo yêu cầu người dùng — test nhanh
        // Cây duyệt Chuyền Line SHIDO/Team HC, xem attendance-module.md). Hash NGAY lúc migration này
        // chạy (Up() là code C# thật, không phải SQL tĩnh) bằng đúng PasswordHasher<object> mà
        // Identity.Application.Services.UserService.ValidateTestLoginAsync dùng để verify.
        private const string TestPassword = "Test@2026";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TestLoginAccounts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestLoginAccounts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TestLoginAccounts_UserName",
                table: "TestLoginAccounts",
                column: "UserName",
                unique: true);

            var hasher = new PasswordHasher<object>();
            var now = DateTime.UtcNow;

            migrationBuilder.InsertData(
                table: "TestLoginAccounts",
                columns: new[] { "UserName", "FullName", "PasswordHash", "IsDeleted", "CreatedAt" },
                values: new object[,]
                {
                    { "TEST\\ll_shido", "[TEST] Line Leader - SHIDO", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\gl_shido", "[TEST] Group Leader - SHIDO", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\tl_shido", "[TEST] Team Leader - SHIDO", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\mgr_ct", "[TEST] Manager - Chế tạo", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\fm_01", "[TEST] Factory Manager", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\dir_01", "[TEST] Director", hasher.HashPassword(null, TestPassword), false, now },
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TestLoginAccounts");
        }
    }
}

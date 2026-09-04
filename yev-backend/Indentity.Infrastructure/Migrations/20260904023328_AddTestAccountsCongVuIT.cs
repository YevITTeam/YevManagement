using System;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTestAccountsCongVuIT : Migration
    {
        // 4 tài khoản TEST mới phủ đủ cấp duyệt của Nhóm "Công vụ - IT" (GroupId=6, Attendance DB
        // YevPCManagement) — theo yêu cầu người dùng 2026-09-04. Cùng mật khẩu dùng chung với các tài
        // khoản TEST khác, cùng cơ chế hash (xem AddTestLoginAccounts). Cấp Manager (M) là
        // DepartmentManager-scope (Bộ phận Công vụ, DepartmentId=6) — cấp Factory Manager phía sau đã
        // dùng chung toàn công ty, TÁI DÙNG luôn TEST\fm_01 có sẵn, không tạo thêm.
        private const string TestPassword = "Test@2026";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var hasher = new PasswordHasher<object>();
            var now = DateTime.UtcNow;

            migrationBuilder.InsertData(
                table: "TestLoginAccounts",
                columns: new[] { "UserName", "FullName", "PasswordHash", "IsDeleted", "CreatedAt" },
                values: new object[,]
                {
                    { "TEST\\st_cvit", "[TEST] Staff - Cong vu IT", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\gl_cvit", "[TEST] Group Leader - Cong vu IT", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\tl_cvit", "[TEST] Team Leader - Cong vu IT", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\mgr_cv", "[TEST] Manager - Cong vu", hasher.HashPassword(null, TestPassword), false, now },
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "DELETE FROM TestLoginAccounts WHERE UserName IN ('TEST\\st_cvit', 'TEST\\gl_cvit', 'TEST\\tl_cvit', 'TEST\\mgr_cv')");
        }
    }
}

using System;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMoreTestLineLeaderAccounts : Migration
    {
        // Cùng mật khẩu với đợt seed đầu (AddTestLoginAccounts) — theo yêu cầu người dùng, test thêm
        // nhiều Line Leader trên các Line thật khác của Chế tạo (đang có Leader thật qua
        // ProductionEmployee.IsLeader nhưng không ai có UserName — xem attendance-module.md §Giai đoạn
        // 12). Sau khi Group Leader/Team Leader đổi sang duyệt chung cả Bộ phận (§Giai đoạn 13), chỉ
        // cần thêm Line Leader cho từng Line là đủ đi hết chuỗi duyệt, không cần tạo thêm GL/TL riêng.
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
                    { "TEST\\ll_4s", "[TEST] Line Leader - 4S", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\ll_ct", "[TEST] Line Leader - CT", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\ll_f", "[TEST] Line Leader - F", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\ll_hl", "[TEST] Line Leader - HL", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\ll_kanbanmae", "[TEST] Line Leader - KANBAN-MAE", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\ll_kza", "[TEST] Line Leader - KZ-A", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\ll_kzm", "[TEST] Line Leader - KZ-M", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\ll_tc", "[TEST] Line Leader - TC", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\ll_tca", "[TEST] Line Leader - TCA", hasher.HashPassword(null, TestPassword), false, now },
                    { "TEST\\ll_tqm", "[TEST] Line Leader - TQM", hasher.HashPassword(null, TestPassword), false, now },
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM TestLoginAccounts WHERE UserName IN (" +
                "'TEST\\ll_4s','TEST\\ll_ct','TEST\\ll_f','TEST\\ll_hl','TEST\\ll_kanbanmae'," +
                "'TEST\\ll_kza','TEST\\ll_kzm','TEST\\ll_tc','TEST\\ll_tca','TEST\\ll_tqm');");
        }
    }
}

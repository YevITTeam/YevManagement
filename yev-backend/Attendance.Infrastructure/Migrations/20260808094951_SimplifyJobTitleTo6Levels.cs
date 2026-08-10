using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SimplifyJobTitleTo6Levels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Thu gọn 14 cấp Chức vụ (OP..GM) còn 6 cấp thật của công ty (2026-08-08, theo yêu cầu
            // người dùng — xem plan file / docs/docs-be/attendance-module.md §Cây chức vụ). KHÔNG tự
            // động remap Employee.JobTitleId cũ sang Chức vụ mới (người dùng chốt: reset về NULL, Admin
            // tự gán lại thủ công) — vì vậy phải xoá sạch cấu hình cây duyệt cũ (DepartmentApprovalStep/
            // GroupApprovalStep tham chiếu JobTitleId cũ) TRƯỚC khi xoá JobTitles cũ, nếu không sẽ vướng
            // FK. Đây là thao tác xoá cấu hình cây duyệt + gán Chức vụ nhân viên THẬT đang có — đã xác
            // nhận với người dùng trước khi áp dụng lên DB thật.
            //
            // OtFormApprovalSteps.JobTitleId cũng FK thẳng tới JobTitles (không chỉ snapshot theo mã/tên
            // như thiết kế gốc) — Admin xác nhận thêm (2026-08-08): xoá LUÔN toàn bộ dữ liệu đơn OT hiện
            // có để dễ test lại từ đầu với Cây chức vụ mới, nên xoá theo đúng thứ tự FK con→cha thay vì
            // chỉ set null/snapshot.
            migrationBuilder.Sql("DELETE FROM OtFormApprovalStepCandidates;");
            migrationBuilder.Sql("DELETE FROM OtFormApprovalEmailTokens;");
            migrationBuilder.Sql("DELETE FROM OtFormApprovalHistories;");
            migrationBuilder.Sql("DELETE FROM OtFormApprovalSteps;");
            migrationBuilder.Sql("DELETE FROM ProcessParts;");
            migrationBuilder.Sql("DELETE FROM OtFormEmployees;");
            migrationBuilder.Sql("DELETE FROM OtForms;");
            migrationBuilder.Sql("DELETE FROM OtFormBatchEmailTokens;");
            migrationBuilder.Sql("DELETE FROM OtFormBatches;");

            migrationBuilder.Sql("DELETE FROM DepartmentApprovalSteps;");
            migrationBuilder.Sql("DELETE FROM GroupApprovalSteps;");
            migrationBuilder.Sql("UPDATE Employees SET JobTitleId = NULL WHERE JobTitleId IS NOT NULL;");

            migrationBuilder.Sql(@"
DELETE FROM JobTitles WHERE Code IN
    ('OP','STAFF','AJS','JS','SUP','ACHIEF','CHIEF','ASM','SM','ADM','M','SRM','FM','GM');");

            migrationBuilder.InsertData(
                table: "JobTitles",
                columns: new[] { "Code", "Name", "RankOrder", "TerminalLevel", "IsDeleted" },
                values: new object[,]
                {
                    { "STAFF", "Staff", 1, 0, false },
                    { "GL", "Group Leader", 2, 0, false },
                    { "TL", "Team Leader", 3, 0, false },
                    { "M", "Manager", 4, 1, false },
                    { "FM", "Factory Manager", 5, 2, false },
                    { "GM", "Director", 6, 3, false }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // LƯU Ý: không thể khôi phục lại cấu hình DepartmentApprovalStep/GroupApprovalStep hay
            // Employee.JobTitleId đã bị xoá ở Up() — Down() chỉ khôi phục lại 14 dòng JobTitle gốc để
            // schema tương thích ngược, dữ liệu gán/cấu hình cụ thể đã mất vĩnh viễn.
            migrationBuilder.Sql("DELETE FROM DepartmentApprovalSteps;");
            migrationBuilder.Sql("DELETE FROM GroupApprovalSteps;");
            migrationBuilder.Sql("UPDATE Employees SET JobTitleId = NULL WHERE JobTitleId IS NOT NULL;");
            migrationBuilder.Sql("DELETE FROM JobTitles WHERE Code IN ('STAFF','GL','TL','M','FM','GM');");

            migrationBuilder.InsertData(
                table: "JobTitles",
                columns: new[] { "Code", "Name", "RankOrder", "TerminalLevel", "IsDeleted" },
                values: new object[,]
                {
                    { "OP", "Operator", 1, 0, false },
                    { "STAFF", "Staff", 2, 0, false },
                    { "AJS", "Assistant Junior Supervisor", 3, 0, false },
                    { "JS", "Junior Supervisor", 4, 0, false },
                    { "SUP", "Supervisor", 5, 0, false },
                    { "ACHIEF", "Assistant Chief", 6, 0, false },
                    { "CHIEF", "Chief", 7, 0, false },
                    { "ASM", "Assistant Section Manager", 8, 0, false },
                    { "SM", "Section Manager", 9, 0, false },
                    { "ADM", "Assistant Department Manager", 10, 0, false },
                    { "M", "Manager", 11, 1, false },
                    { "SRM", "Senior Manager", 12, 0, false },
                    { "FM", "Factory Manager", 13, 2, false },
                    { "GM", "General Director", 14, 3, false }
                });
        }
    }
}

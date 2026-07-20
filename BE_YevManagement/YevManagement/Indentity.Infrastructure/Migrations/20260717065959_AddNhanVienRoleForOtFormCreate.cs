using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNhanVienRoleForOtFormCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Role mới "Nhân viên" — tách "tạo đơn tăng ca" khỏi "ký duyệt Trưởng nhóm" (2026-07-17,
            // xem docs/attendance-module.md). Nhân viên tạo được đơn cho ĐÚNG Group của chính mình
            // (OtFormService.CreateAsync suy ra qua Employee.GroupId, không cần UserApprovalScope), nhưng
            // KHÔNG ký/duyệt được ở bất kỳ cấp nào (ApproveSubmitterAsync/ApproveAsync vẫn chỉ chấp nhận
            // UserApprovalScope, Role này không có và không được Admin gán qua UserApprovalScope).
            // Bộ permission giống hệt "màn Tạo đơn tăng ca" của Trưởng Group, trừ UserSignature.Update
            // (Nhân viên không ký nên không cần đăng ký chữ ký).
            migrationBuilder.Sql(@"
INSERT INTO Roles (RoleName, Description, IsDeleted) VALUES
(N'Nhân viên', N'Tạo đơn tăng ca cho nhóm mình phụ trách — không ký/duyệt', 0);

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Nhân viên' AND r.IsDeleted = 0
  AND p.Code IN (
      N'Attendance.OTForm.Create', N'Attendance.OTForm.View', N'Attendance.Employee.View',
      N'Attendance.Department.View', N'Attendance.Group.View', N'Attendance.Reason.View', N'Attendance.OtCase.View');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE RoleId IN (
    SELECT Id FROM Roles WHERE RoleName = N'Nhân viên');
DELETE FROM Roles WHERE RoleName = N'Nhân viên';
");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupHeadRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Role mới "Trưởng Bộ phận" — cấp duyệt GroupHead (2026-07-17, phát hiện thiếu qua email
            // thật của BP Kế hoạch - 1PC4L), chèn giữa Trưởng nhóm (Submitter) và Trưởng phòng
            // (DepartmentManager) trong luồng duyệt: Trưởng nhóm ký -> Trưởng Bộ phận ký -> Trưởng
            // phòng duyệt -> ... (xem docs/attendance-module.md). Ms Nhung chỉ duyệt/ký, không tạo đơn
            // -> dùng lại đúng bộ permission của Trưởng phòng/Trưởng xưởng/TGĐ.
            migrationBuilder.Sql(@"
INSERT INTO Roles (RoleName, Description, IsDeleted) VALUES
(N'Trưởng Bộ phận', N'Duyệt đơn tăng ca cấp GroupHead — sau Trưởng nhóm ký, trước Trưởng phòng duyệt', 0);

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Trưởng Bộ phận' AND r.IsDeleted = 0
  AND p.Code IN (N'Attendance.OTForm.View', N'Attendance.OTForm.Approve', N'Attendance.UserSignature.Update');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE RoleId IN (
    SELECT Id FROM Roles WHERE RoleName = N'Trưởng Bộ phận');
DELETE FROM Roles WHERE RoleName = N'Trưởng Bộ phận';
");
        }
    }
}

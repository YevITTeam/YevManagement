using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCategoryViewPermissionsToTruongGroup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Trưởng Group thiếu quyền xem 4 bảng danh mục (Department/Group/Reason/OtCase) cần cho
            // dropdown lúc tạo đơn — GET .../all, .../by-department/{id} đều gate bằng {Entity}.View
            // riêng, không nằm trong OTForm.View. Thiếu 4 quyền này thì màn "Tạo đơn tăng ca" không load
            // được dropdown nào cả (xem docs/attendance-module.md).
            migrationBuilder.Sql(@"
INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Trưởng Group' AND r.IsDeleted = 0
  AND p.Code IN (N'Attendance.Department.View', N'Attendance.Group.View', N'Attendance.Reason.View', N'Attendance.OtCase.View')
  AND NOT EXISTS (
      SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE rp FROM RolePermissions rp
JOIN Roles r ON r.Id = rp.RoleId
JOIN Permissions p ON p.Id = rp.PermissionId
WHERE r.RoleName = N'Trưởng Group'
  AND p.Code IN (N'Attendance.Department.View', N'Attendance.Group.View', N'Attendance.Reason.View', N'Attendance.OtCase.View');
");
        }
    }
}

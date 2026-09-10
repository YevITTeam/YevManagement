using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOtFormViewAllPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.OTForm.ViewAll: xem tab "Tất cả đơn" (GET /api/OtForm/all-forms) — toàn bộ đơn
            // tăng ca không phân biệt người tạo/phạm vi duyệt (2026-09-04). Cố tình CHỈ gán cho Admin
            // (piggyback trên Attendance.Department.Create, cùng cách làm với Attendance.OTForm.Delete) —
            // không role nghiệp vụ nào khác được xem toàn cục, chỉ Admin.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.OTForm.ViewAll', N'Attendance', N'Xem toàn bộ đơn tăng ca (tab Tất cả đơn, Admin)');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId AND dp.Code = N'Attendance.Department.Create'
CROSS JOIN Permissions p
WHERE p.Code = N'Attendance.OTForm.ViewAll';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.OTForm.ViewAll');
DELETE FROM Permissions WHERE Code = N'Attendance.OTForm.ViewAll';
");
        }
    }
}

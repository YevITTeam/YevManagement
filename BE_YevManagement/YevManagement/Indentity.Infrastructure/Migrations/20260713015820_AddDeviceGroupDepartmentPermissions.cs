using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceGroupDepartmentPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Seed permission cho 2 bảng master data mới của Asset: DeviceGroup (Nhóm) và
            // DeviceDepartment (Bộ phận) — dùng để phân loại "thiết bị đang ở chỗ nào".
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Asset.DeviceGroup.View', N'Asset', N'Xem danh sách / chi tiết nhóm'),
(N'Asset.DeviceGroup.Create', N'Asset', N'Thêm nhóm'),
(N'Asset.DeviceGroup.Update', N'Asset', N'Sửa nhóm'),
(N'Asset.DeviceGroup.Delete', N'Asset', N'Xóa nhóm'),
(N'Asset.DeviceDepartment.View', N'Asset', N'Xem danh sách / chi tiết bộ phận'),
(N'Asset.DeviceDepartment.Create', N'Asset', N'Thêm bộ phận'),
(N'Asset.DeviceDepartment.Update', N'Asset', N'Sửa bộ phận'),
(N'Asset.DeviceDepartment.Delete', N'Asset', N'Xóa bộ phận');

-- Gán permission mới cho role Admin hiện có, cùng lý do với migration seed permission ban đầu.
INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0
  AND p.Code IN (N'Asset.DeviceGroup.View', N'Asset.DeviceGroup.Create', N'Asset.DeviceGroup.Update', N'Asset.DeviceGroup.Delete',
                 N'Asset.DeviceDepartment.View', N'Asset.DeviceDepartment.Create', N'Asset.DeviceDepartment.Update', N'Asset.DeviceDepartment.Delete');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code IN (
        N'Asset.DeviceGroup.View', N'Asset.DeviceGroup.Create', N'Asset.DeviceGroup.Update', N'Asset.DeviceGroup.Delete',
        N'Asset.DeviceDepartment.View', N'Asset.DeviceDepartment.Create', N'Asset.DeviceDepartment.Update', N'Asset.DeviceDepartment.Delete'));
DELETE FROM Permissions WHERE Code IN (
    N'Asset.DeviceGroup.View', N'Asset.DeviceGroup.Create', N'Asset.DeviceGroup.Update', N'Asset.DeviceGroup.Delete',
    N'Asset.DeviceDepartment.View', N'Asset.DeviceDepartment.Create', N'Asset.DeviceDepartment.Update', N'Asset.DeviceDepartment.Delete');
");
        }
    }
}

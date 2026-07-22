using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPermissionAndRolePermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Permissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Module = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Permissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RolePermissions",
                columns: table => new
                {
                    RoleId = table.Column<int>(type: "int", nullable: false),
                    PermissionId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RolePermissions", x => new { x.RoleId, x.PermissionId });
                    table.ForeignKey(
                        name: "FK_RolePermissions_Permissions_PermissionId",
                        column: x => x.PermissionId,
                        principalTable: "Permissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RolePermissions_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Permissions_Code",
                table: "Permissions",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_PermissionId",
                table: "RolePermissions",
                column: "PermissionId");

            // Seed the fixed permission list, derived from existing controllers/actions.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Asset.Branch.View', N'Asset', N'Xem danh sách / chi tiết chi nhánh'),
(N'Asset.Branch.Create', N'Asset', N'Thêm chi nhánh'),
(N'Asset.Branch.Update', N'Asset', N'Sửa chi nhánh'),
(N'Asset.Branch.Delete', N'Asset', N'Xóa chi nhánh'),
(N'Asset.Device.View', N'Asset', N'Xem danh sách / chi tiết thiết bị'),
(N'Asset.Device.Create', N'Asset', N'Thêm thiết bị'),
(N'Asset.Device.Update', N'Asset', N'Sửa thiết bị'),
(N'Asset.Device.Delete', N'Asset', N'Xóa thiết bị'),
(N'Asset.DeviceType.View', N'Asset', N'Xem danh sách / chi tiết loại thiết bị'),
(N'Asset.DeviceType.Create', N'Asset', N'Thêm loại thiết bị'),
(N'Asset.DeviceType.Update', N'Asset', N'Sửa loại thiết bị'),
(N'Asset.DeviceType.Delete', N'Asset', N'Xóa loại thiết bị'),
(N'Asset.Supplier.View', N'Asset', N'Xem danh sách / chi tiết nhà cung cấp'),
(N'Asset.Supplier.Create', N'Asset', N'Thêm nhà cung cấp'),
(N'Asset.Supplier.Update', N'Asset', N'Sửa nhà cung cấp'),
(N'Asset.Supplier.Delete', N'Asset', N'Xóa nhà cung cấp'),
(N'Asset.Software.View', N'Asset', N'Xem danh sách / chi tiết phần mềm'),
(N'Asset.Software.Create', N'Asset', N'Thêm phần mềm'),
(N'Asset.Software.Update', N'Asset', N'Sửa phần mềm'),
(N'Asset.Software.Delete', N'Asset', N'Xóa phần mềm'),
(N'Asset.SoftwareGroup.View', N'Asset', N'Xem danh sách / chi tiết nhóm phần mềm'),
(N'Asset.SoftwareGroup.Create', N'Asset', N'Thêm nhóm phần mềm'),
(N'Asset.SoftwareGroup.Update', N'Asset', N'Sửa nhóm phần mềm'),
(N'Asset.SoftwareGroup.Delete', N'Asset', N'Xóa nhóm phần mềm'),
(N'Asset.IpPrefix.View', N'Asset', N'Xem danh sách / chi tiết dải IP (prefix)'),
(N'Asset.IpPrefix.Create', N'Asset', N'Thêm dải IP (prefix)'),
(N'Asset.IpPrefix.Update', N'Asset', N'Sửa dải IP (prefix)'),
(N'Asset.IpPrefix.Delete', N'Asset', N'Xóa dải IP (prefix)'),
(N'Asset.IpAddress.View', N'Asset', N'Xem danh sách / chi tiết địa chỉ IP'),
(N'Asset.IpAddress.Create', N'Asset', N'Thêm địa chỉ IP'),
(N'Asset.IpAddress.Update', N'Asset', N'Sửa địa chỉ IP'),
(N'Asset.IpAddress.Delete', N'Asset', N'Xóa địa chỉ IP'),
(N'Asset.IpAddress.Assign', N'Asset', N'Gán / gỡ gán địa chỉ IP cho thiết bị'),
(N'Asset.DeviceConfiguration.View', N'Asset', N'Xem cấu hình / lịch sử cấu hình thiết bị'),
(N'Asset.DeviceConfiguration.Create', N'Asset', N'Thêm cấu hình thiết bị'),
(N'Asset.DeviceConfiguration.Update', N'Asset', N'Sửa cấu hình thiết bị'),
(N'Asset.DeviceConfiguration.Delete', N'Asset', N'Xóa cấu hình thiết bị / cấu hình ban đầu'),
(N'Asset.DeviceSoftware.View', N'Asset', N'Xem danh sách phần mềm đã cài trên thiết bị'),
(N'Asset.DeviceSoftware.Create', N'Asset', N'Cài phần mềm cho thiết bị'),
(N'Asset.DeviceSoftware.Update', N'Asset', N'Sửa thông tin cài đặt / đồng bộ phần mềm thiết bị'),
(N'Asset.DeviceSoftware.Delete', N'Asset', N'Gỡ phần mềm khỏi thiết bị'),
(N'Asset.Report.View', N'Asset', N'Xem báo cáo thiết bị'),
(N'Asset.TransferHistory.View', N'Asset', N'Xem lịch sử chuyển máy'),
(N'Asset.TransferHistory.Create', N'Asset', N'Thực hiện chuyển máy'),
(N'Identity.User.View', N'Identity', N'Xem danh sách người dùng kèm quyền'),
(N'Identity.User.UpdateRoles', N'Identity', N'Gán quyền (role) cho người dùng'),
(N'Identity.Role.View', N'Identity', N'Xem danh sách quyền (role)'),
(N'Identity.Role.Create', N'Identity', N'Tạo quyền (role)'),
(N'Identity.Role.Update', N'Identity', N'Sửa quyền (role) / gán chức năng cho quyền'),
(N'Identity.Role.Delete', N'Identity', N'Xóa quyền (role)'),
(N'Identity.Permission.View', N'Identity', N'Xem danh sách chức năng (permission) hệ thống');

-- Gán toàn bộ permission cho role Admin hiện có, tránh mất quyền truy cập sau khi chuyển sang cơ chế permission.
INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RolePermissions");

            migrationBuilder.DropTable(
                name: "Permissions");
        }
    }
}

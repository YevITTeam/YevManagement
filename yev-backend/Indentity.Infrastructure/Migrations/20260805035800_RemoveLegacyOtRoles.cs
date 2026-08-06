using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    // Xoá 5 Role legacy theo từng cấp duyệt OT (Trưởng nhóm/Trưởng Bộ phận/Trưởng phòng/Trưởng xưởng/
    // Tổng Giám Đốc) — bước "Dọn dẹp" của migration AddQuanLyTangCaRole, xem
    // ~/.claude/plans/attendance-single-role-permission-refactor.md. Verify dữ liệu thật (2026-08-05)
    // trước khi viết migration này: đúng 4 user thật đang giữ 1 trong 5 Role này —
    // YEV\m.khoi80419 (Trưởng nhóm), YEV\t.nhung50 (Trưởng phòng), YEV\tuan.system.da (Trưởng Bộ
    // phận), YEV\v.vinh72266 (Trưởng phòng). Không ai giữ Tổng Giám Đốc/Trưởng xưởng.
    // Nguyên tắc an toàn: KHÔNG thu hồi quyền của 4 người này — trước khi xoá Role, gán họ Role
    // `Quản lý tăng ca` + cấp lại ĐÚNG BỘ permission mà Role cũ của họ đang có (qua UserPermissions,
    // IsGranted=1), để permission hiệu lực (Role ∪ override) không đổi sau khi Role cũ biến mất.
    public partial class RemoveLegacyOtRoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @NewRoleId INT = (SELECT Id FROM Roles WHERE RoleName = N'Quản lý tăng ca');

-- 1) Gán Role mới cho 4 user thật đang giữ 1 trong 5 Role legacy (idempotent).
INSERT INTO UserRoles (UserId, RoleId)
SELECT u.Id, @NewRoleId
FROM Users u
WHERE u.UserName IN (N'YEV\m.khoi80419', N'YEV\t.nhung50', N'YEV\tuan.system.da', N'YEV\v.vinh72266')
  AND NOT EXISTS (SELECT 1 FROM UserRoles ur WHERE ur.UserId = u.Id AND ur.RoleId = @NewRoleId);

-- 2) Cấp lại (UserPermissions.IsGranted=1) đúng bộ permission mà Role legacy của từng user đang có,
--    để permission hiệu lực KHÔNG đổi sau khi Role đó bị xoá ở bước 4 (idempotent).
INSERT INTO UserPermissions (UserId, PermissionId, IsGranted)
SELECT u.Id, rp.PermissionId, 1
FROM Users u
JOIN UserRoles ur ON ur.UserId = u.Id
JOIN Roles r ON r.Id = ur.RoleId
JOIN RolePermissions rp ON rp.RoleId = r.Id
WHERE r.RoleName IN (N'Trưởng nhóm', N'Trưởng Bộ phận', N'Trưởng phòng', N'Trưởng xưởng', N'Tổng Giám Đốc')
  AND NOT EXISTS (SELECT 1 FROM UserPermissions up WHERE up.UserId = u.Id AND up.PermissionId = rp.PermissionId);

-- 3) Gỡ liên kết User-Role cũ (bắt buộc trước khi xoá Role vì UserRoles có FK tới Roles).
DELETE FROM UserRoles WHERE RoleId IN (
    SELECT Id FROM Roles WHERE RoleName IN (N'Trưởng nhóm', N'Trưởng Bộ phận', N'Trưởng phòng', N'Trưởng xưởng', N'Tổng Giám Đốc'));

-- 4) Xoá Role-Permission rồi xoá Role.
DELETE FROM RolePermissions WHERE RoleId IN (
    SELECT Id FROM Roles WHERE RoleName IN (N'Trưởng nhóm', N'Trưởng Bộ phận', N'Trưởng phòng', N'Trưởng xưởng', N'Tổng Giám Đốc'));

DELETE FROM Roles WHERE RoleName IN (N'Trưởng nhóm', N'Trưởng Bộ phận', N'Trưởng phòng', N'Trưởng xưởng', N'Tổng Giám Đốc');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
-- 1) Tạo lại 5 Role legacy với đúng Description gốc.
INSERT INTO Roles (RoleName, Description, IsDeleted) VALUES
(N'Trưởng nhóm', N'Người đề nghị (Submitter) — tạo đơn tăng ca cho nhóm mình phụ trách', 0),
(N'Trưởng phòng', N'Duyệt đơn tăng ca cấp DepartmentManager (TH1 dừng ở đây)', 0),
(N'Trưởng xưởng', N'Duyệt đơn tăng ca cấp WorkshopManager (TH2 dừng ở đây)', 0),
(N'Tổng Giám Đốc', N'Duyệt đơn tăng ca cấp GeneralDirector (TH3), bypass UserApprovalScope', 0),
(N'Trưởng Bộ phận', N'Duyệt đơn tăng ca cấp GroupHead — sau Trưởng nhóm ký, trước Trưởng phòng duyệt', 0);

-- 2) Cấp lại đúng bộ permission gốc cho từng Role.
INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Trưởng nhóm' AND r.IsDeleted = 0
  AND p.Code IN (N'Attendance.Department.View', N'Attendance.Employee.View', N'Attendance.Group.View',
                 N'Attendance.OtCase.View', N'Attendance.OTForm.Create', N'Attendance.OTForm.RemoveEmployee',
                 N'Attendance.OTForm.View', N'Attendance.Reason.View', N'Attendance.SecondaryPassword.Update',
                 N'Attendance.UserSignature.Update');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName IN (N'Trưởng phòng', N'Trưởng xưởng', N'Tổng Giám Đốc', N'Trưởng Bộ phận') AND r.IsDeleted = 0
  AND p.Code IN (N'Attendance.OtCase.View', N'Attendance.OTForm.Approve', N'Attendance.OTForm.RemoveEmployee',
                 N'Attendance.OTForm.View', N'Attendance.SecondaryPassword.Update', N'Attendance.UserSignature.Update');

-- 3) Gán lại đúng 4 user thật về Role legacy tương ứng.
INSERT INTO UserRoles (UserId, RoleId)
SELECT u.Id, r.Id FROM Users u JOIN Roles r ON r.RoleName = N'Trưởng nhóm' AND r.IsDeleted = 0
WHERE u.UserName = N'YEV\m.khoi80419';

INSERT INTO UserRoles (UserId, RoleId)
SELECT u.Id, r.Id FROM Users u JOIN Roles r ON r.RoleName = N'Trưởng phòng' AND r.IsDeleted = 0
WHERE u.UserName IN (N'YEV\t.nhung50', N'YEV\v.vinh72266');

INSERT INTO UserRoles (UserId, RoleId)
SELECT u.Id, r.Id FROM Users u JOIN Roles r ON r.RoleName = N'Trưởng Bộ phận' AND r.IsDeleted = 0
WHERE u.UserName = N'YEV\tuan.system.da';

-- 4) Gỡ override + gỡ Role mới đã gán cho đúng 4 user này ở Up() (không đụng override/Role của ai khác).
DECLARE @NewRoleId INT = (SELECT Id FROM Roles WHERE RoleName = N'Quản lý tăng ca');

DELETE up FROM UserPermissions up
JOIN Users u ON u.Id = up.UserId
WHERE u.UserName IN (N'YEV\m.khoi80419', N'YEV\t.nhung50', N'YEV\tuan.system.da', N'YEV\v.vinh72266')
  AND up.IsGranted = 1
  AND up.PermissionId IN (
      SELECT p.Id FROM Permissions p
      WHERE p.Code IN (N'Attendance.Department.View', N'Attendance.Employee.View', N'Attendance.Group.View',
                        N'Attendance.OtCase.View', N'Attendance.OTForm.Create', N'Attendance.OTForm.RemoveEmployee',
                        N'Attendance.OTForm.View', N'Attendance.Reason.View', N'Attendance.SecondaryPassword.Update',
                        N'Attendance.UserSignature.Update', N'Attendance.OTForm.Approve'));

DELETE ur FROM UserRoles ur
JOIN Users u ON u.Id = ur.UserId
WHERE u.UserName IN (N'YEV\m.khoi80419', N'YEV\t.nhung50', N'YEV\tuan.system.da', N'YEV\v.vinh72266')
  AND ur.RoleId = @NewRoleId;
");
        }
    }
}

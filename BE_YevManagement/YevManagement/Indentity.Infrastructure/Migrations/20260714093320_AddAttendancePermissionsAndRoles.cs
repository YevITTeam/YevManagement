using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAttendancePermissionsAndRoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Seed permission cho module Attendance: danh mục (Department/Group/Reason/OtCase/Employee),
            // phân quyền duyệt (UserApprovalScope), chữ ký (UserSignature) và nghiệp vụ chính (OTForm).
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.Department.View', N'Attendance', N'Xem danh sách / chi tiết bộ phận'),
(N'Attendance.Department.Create', N'Attendance', N'Thêm bộ phận'),
(N'Attendance.Department.Update', N'Attendance', N'Sửa bộ phận'),
(N'Attendance.Department.Delete', N'Attendance', N'Xóa bộ phận'),
(N'Attendance.Group.View', N'Attendance', N'Xem danh sách / chi tiết nhóm'),
(N'Attendance.Group.Create', N'Attendance', N'Thêm nhóm'),
(N'Attendance.Group.Update', N'Attendance', N'Sửa nhóm'),
(N'Attendance.Group.Delete', N'Attendance', N'Xóa nhóm'),
(N'Attendance.Reason.View', N'Attendance', N'Xem danh sách / chi tiết lý do'),
(N'Attendance.Reason.Create', N'Attendance', N'Thêm lý do'),
(N'Attendance.Reason.Update', N'Attendance', N'Sửa lý do'),
(N'Attendance.Reason.Delete', N'Attendance', N'Xóa lý do'),
(N'Attendance.OtCase.View', N'Attendance', N'Xem danh sách / chi tiết trường hợp OT'),
(N'Attendance.OtCase.Create', N'Attendance', N'Thêm trường hợp OT'),
(N'Attendance.OtCase.Update', N'Attendance', N'Sửa trường hợp OT'),
(N'Attendance.OtCase.Delete', N'Attendance', N'Xóa trường hợp OT'),
(N'Attendance.Employee.View', N'Attendance', N'Xem danh sách / chi tiết nhân viên'),
(N'Attendance.Employee.Create', N'Attendance', N'Thêm nhân viên'),
(N'Attendance.Employee.Update', N'Attendance', N'Sửa nhân viên'),
(N'Attendance.Employee.Delete', N'Attendance', N'Xóa nhân viên'),
(N'Attendance.UserApprovalScope.View', N'Attendance', N'Xem phân quyền duyệt theo phạm vi'),
(N'Attendance.UserApprovalScope.Create', N'Attendance', N'Gán phân quyền duyệt theo phạm vi'),
(N'Attendance.UserApprovalScope.Delete', N'Attendance', N'Xóa phân quyền duyệt theo phạm vi'),
(N'Attendance.UserSignature.View', N'Attendance', N'Xem chữ ký đã đăng ký của người khác (admin)'),
(N'Attendance.UserSignature.Update', N'Attendance', N'Đăng ký / cập nhật chữ ký của chính mình'),
(N'Attendance.OTForm.View', N'Attendance', N'Xem đơn tăng ca (của mình / cần duyệt)'),
(N'Attendance.OTForm.Create', N'Attendance', N'Tạo đơn tăng ca'),
(N'Attendance.OTForm.Approve', N'Attendance', N'Duyệt / từ chối đơn tăng ca');

-- Gán toàn bộ permission Attendance mới cho role Admin, cùng lý do với migration seed permission ban đầu.
INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0
  AND p.Module = N'Attendance';

-- Seed 4 Role nghiệp vụ OT theo phiếu giấy thật YEV-22-024 (xem docs/attendance-module.md).
INSERT INTO Roles (RoleName, Description, IsDeleted) VALUES
(N'Trưởng Group', N'Người đề nghị (Submitter) — tạo đơn tăng ca cho nhóm mình phụ trách', 0),
(N'Trưởng phòng', N'Duyệt đơn tăng ca cấp DepartmentManager (TH1 dừng ở đây)', 0),
(N'Trưởng xưởng', N'Duyệt đơn tăng ca cấp WorkshopManager (TH2 dừng ở đây)', 0),
(N'Tổng Giám Đốc', N'Duyệt đơn tăng ca cấp GeneralDirector (TH3), bypass UserApprovalScope', 0);

-- Trưởng Group: tạo + xem đơn, xem nhân viên nhóm mình, tự đăng ký chữ ký.
INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Trưởng Group' AND r.IsDeleted = 0
  AND p.Code IN (N'Attendance.OTForm.Create', N'Attendance.OTForm.View', N'Attendance.Employee.View', N'Attendance.UserSignature.Update');

-- Trưởng phòng / Trưởng xưởng / Tổng Giám Đốc: xem + duyệt đơn, tự đăng ký chữ ký.
INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName IN (N'Trưởng phòng', N'Trưởng xưởng', N'Tổng Giám Đốc') AND r.IsDeleted = 0
  AND p.Code IN (N'Attendance.OTForm.View', N'Attendance.OTForm.Approve', N'Attendance.UserSignature.Update');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE RoleId IN (
    SELECT Id FROM Roles WHERE RoleName IN (N'Trưởng Group', N'Trưởng phòng', N'Trưởng xưởng', N'Tổng Giám Đốc'));
DELETE FROM Roles WHERE RoleName IN (N'Trưởng Group', N'Trưởng phòng', N'Trưởng xưởng', N'Tổng Giám Đốc');

DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Module = N'Attendance');
DELETE FROM Permissions WHERE Module = N'Attendance';
");
        }
    }
}

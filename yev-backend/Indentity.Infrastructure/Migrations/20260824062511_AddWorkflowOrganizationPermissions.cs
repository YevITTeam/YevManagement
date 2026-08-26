using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowOrganizationPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Workflow.Organization.*: quyền thô cho module Workflow (form builder động + duyệt nhiều
            // cấp, DB YevWorkflowManagement) — xem docs/docs-be/workflow-module.md §7. Phase 1 chỉ có
            // nhóm bảng Tổ chức + nhân sự (OrgLevels/OrgUnits/JobTitles/Employees/EmployeeOrgUnits),
            // nên seed đúng 2 permission cho nhóm này trước. Luật chi tiết (ai thiết kế form nào, ai
            // duyệt bước nào) là dữ liệu trong DB, không phải permission — sẽ không có thêm permission
            // Workflow.Organization.* nào khác. Chỉ gán Admin ở migration đầu, cùng tiền lệ
            // AddAttendanceAiChatPermission/AddAssetAiChatPermission.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Workflow.Organization.View', N'Workflow', N'Xem cây tổ chức, chức danh, nhân sự'),
(N'Workflow.Organization.Manage', N'Workflow', N'Quản lý cây tổ chức, chức danh, nhân sự');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0
  AND p.Code IN (N'Workflow.Organization.View', N'Workflow.Organization.Manage');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code IN (
        N'Workflow.Organization.View', N'Workflow.Organization.Manage'));
DELETE FROM Permissions WHERE Code IN (
    N'Workflow.Organization.View', N'Workflow.Organization.Manage');
");
        }
    }
}

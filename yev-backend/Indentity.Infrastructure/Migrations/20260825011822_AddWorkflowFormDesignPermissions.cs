using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowFormDesignPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Workflow.FormDesign.*/Workflow.Setting.Manage: quyền thô cho Pha 2A của module Workflow
            // (danh mục form + nguồn dữ liệu, xem docs/docs-be/workflow-module.md §7, §8). Luật chi
            // tiết "ai được thiết kế form của thư mục nào" là dữ liệu ở FormCategoryCoordinators,
            // không phải permission. Workflow.Setting.Manage gộp chung nhóm cấu hình admin-only
            // (FormDataSources ở Pha 2A, WorkflowSettings ở Pha 4 sau này) — chỉ 1 permission, không
            // có cặp View/Manage riêng vì đây toàn màn hình admin. Chỉ gán Admin, cùng tiền lệ
            // AddWorkflowOrganizationPermissions.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Workflow.FormDesign.View', N'Workflow', N'Xem danh mục form và người phụ trách thiết kế'),
(N'Workflow.FormDesign.Manage', N'Workflow', N'Quản lý danh mục form và người phụ trách thiết kế'),
(N'Workflow.Setting.Manage', N'Workflow', N'Quản lý nguồn dữ liệu và cấu hình chung của Workflow');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0
  AND p.Code IN (N'Workflow.FormDesign.View', N'Workflow.FormDesign.Manage', N'Workflow.Setting.Manage');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code IN (
        N'Workflow.FormDesign.View', N'Workflow.FormDesign.Manage', N'Workflow.Setting.Manage'));
DELETE FROM Permissions WHERE Code IN (
    N'Workflow.FormDesign.View', N'Workflow.FormDesign.Manage', N'Workflow.Setting.Manage');
");
        }
    }
}

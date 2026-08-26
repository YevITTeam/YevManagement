using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowSignaturePermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Workflow.Signature.Update: quyền tự quản chữ ký đăng ký sẵn của CHÍNH mình (Pha 4 — xem
            // docs/docs-be/workflow-module.md §3.4, §7, §8). Chỉ 1 quyền duy nhất (không có cặp
            // View/Manage) vì action GET/PUT "me" đều tự giới hạn vào chủ tài khoản; 2 action "confirm"
            // là [AllowAnonymous] nên không cần permission. Chỉ gán Admin, cùng tiền lệ
            // AddWorkflowRequestPermissions/AddWorkflowFormDesignPermissions.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Workflow.Signature.Update', N'Workflow', N'Đăng ký/cập nhật chữ ký điện tử của chính mình');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0
  AND p.Code = N'Workflow.Signature.Update';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Workflow.Signature.Update');
DELETE FROM Permissions WHERE Code = N'Workflow.Signature.Update';
");
        }
    }
}

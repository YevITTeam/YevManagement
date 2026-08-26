using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowRequestPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Workflow.Request.Create/ViewAll: quyền thô cho Pha 3B-1 (engine nộp/duyệt đơn — xem
            // docs/docs-be/workflow-module.md §7, §8). Luật chi tiết "ai duyệt được bước nào / ai xem
            // được đơn nào" là dữ liệu ở WorkflowRequestStepParticipants + ApprovalDelegations, không
            // phải permission — cả 2 quyền này dùng chung cho MỌI action trên WorkflowRequestController
            // (submit/approve/reject/send-back/add-approver/cancel), Service tự enforce chi tiết. Chỉ
            // gán Admin, cùng tiền lệ AddWorkflowOrganizationPermissions/AddWorkflowFormDesignPermissions.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Workflow.Request.Create', N'Workflow', N'Tạo, nộp và duyệt đơn (loại đơn nào do FormAccesses quyết)'),
(N'Workflow.Request.ViewAll', N'Workflow', N'Xem mọi đơn toàn công ty');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0
  AND p.Code IN (N'Workflow.Request.Create', N'Workflow.Request.ViewAll');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code IN (
        N'Workflow.Request.Create', N'Workflow.Request.ViewAll'));
DELETE FROM Permissions WHERE Code IN (
    N'Workflow.Request.Create', N'Workflow.Request.ViewAll');
");
        }
    }
}

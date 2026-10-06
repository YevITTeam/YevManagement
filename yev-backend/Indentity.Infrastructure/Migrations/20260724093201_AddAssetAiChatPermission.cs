using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAssetAiChatPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Asset.AiChat.Use: gọi endpoint POST /api/AiChat/stream (trợ lý AI tra cứu dữ liệu Asset
            // qua tool-calling nội bộ, xem docs/docs-be/asset-module.md §1.18). Cùng pattern với migration
            // seed permission AddAssetAuditTrailPermission.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Asset.AiChat.Use', N'Asset', N'Sử dụng trợ lý AI tra cứu dữ liệu Asset');

-- Gán permission mới cho role Admin hiện có, cùng lý do với migration seed permission ban đầu.
INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0
  AND p.Code = N'Asset.AiChat.Use';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Asset.AiChat.Use');
DELETE FROM Permissions WHERE Code = N'Asset.AiChat.Use';
");
        }
    }
}

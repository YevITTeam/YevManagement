-- Identity DB: seeds Attendance.ProductionCatalog.Manage for Admin. Safe to re-run.
USE [YevIdentityManagement_Production];
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109042103_AddProductionCatalogPermission'
)
BEGIN

    INSERT INTO Permissions (Code, Module, Description)
    SELECT N'Attendance.ProductionCatalog.Manage', N'Attendance', N'Quản lý danh mục Line, Team, Nhóm ca'
    WHERE NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.Code = N'Attendance.ProductionCatalog.Manage');

    INSERT INTO RolePermissions (RoleId, PermissionId)
    SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
    WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0 AND p.Code = N'Attendance.ProductionCatalog.Manage'
      AND NOT EXISTS (SELECT 1 FROM RolePermissions x WHERE x.RoleId = r.Id AND x.PermissionId = p.Id);

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109042103_AddProductionCatalogPermission'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261109042103_AddProductionCatalogPermission', N'10.0.9');
END;

COMMIT;
GO


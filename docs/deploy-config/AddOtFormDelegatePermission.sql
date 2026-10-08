BEGIN TRANSACTION;

INSERT INTO Permissions (Code, Module, Description)
SELECT N'Attendance.OTForm.Delegate', N'Attendance', N'Ủy quyền duyệt đơn tăng ca cho người khác'
WHERE NOT EXISTS (SELECT 1 FROM Permissions WHERE Code = N'Attendance.OTForm.Delegate');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0 AND p.Code = N'Attendance.OTForm.Delegate'
  AND NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);


INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20261008035224_AddOtFormDelegatePermission', N'10.0.9');

COMMIT;
GO


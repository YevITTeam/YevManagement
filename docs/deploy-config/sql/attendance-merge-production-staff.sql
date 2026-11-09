-- Attendance DB: moves production staff onto Employees and merges form creators into the lent-people list.
-- Drops tables, so back up first; run while the site is stopped, then deploy the matching build. Safe to re-run.
USE [YevOTManagement_Production];
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109035255_MergeProductionEmployeeIntoEmployee'
)
BEGIN
    ALTER TABLE [Employees] ADD [CongDoan] nvarchar(50) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109035255_MergeProductionEmployeeIntoEmployee'
)
BEGIN
    ALTER TABLE [Employees] ADD [IsLineLeader] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109035255_MergeProductionEmployeeIntoEmployee'
)
BEGIN
    ALTER TABLE [Employees] ADD [ProductionLineId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109035255_MergeProductionEmployeeIntoEmployee'
)
BEGIN
    ALTER TABLE [Employees] ADD [ShiftTeamId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109035255_MergeProductionEmployeeIntoEmployee'
)
BEGIN
    ALTER TABLE [Employees] ADD [TaskName] nvarchar(255) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109035255_MergeProductionEmployeeIntoEmployee'
)
BEGIN
    ALTER TABLE [Employees] ADD [TeamId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109035255_MergeProductionEmployeeIntoEmployee'
)
BEGIN
    CREATE INDEX [IX_Employees_ProductionLineId] ON [Employees] ([ProductionLineId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109035255_MergeProductionEmployeeIntoEmployee'
)
BEGIN
    CREATE INDEX [IX_Employees_ShiftTeamId] ON [Employees] ([ShiftTeamId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109035255_MergeProductionEmployeeIntoEmployee'
)
BEGIN
    CREATE INDEX [IX_Employees_TeamId] ON [Employees] ([TeamId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109035255_MergeProductionEmployeeIntoEmployee'
)
BEGIN
    ALTER TABLE [Employees] ADD CONSTRAINT [FK_Employees_ProductionLines_ProductionLineId] FOREIGN KEY ([ProductionLineId]) REFERENCES [ProductionLines] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109035255_MergeProductionEmployeeIntoEmployee'
)
BEGIN
    ALTER TABLE [Employees] ADD CONSTRAINT [FK_Employees_ProductionShiftTeams_ShiftTeamId] FOREIGN KEY ([ShiftTeamId]) REFERENCES [ProductionShiftTeams] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109035255_MergeProductionEmployeeIntoEmployee'
)
BEGIN
    ALTER TABLE [Employees] ADD CONSTRAINT [FK_Employees_ProductionTeams_TeamId] FOREIGN KEY ([TeamId]) REFERENCES [ProductionTeams] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109035255_MergeProductionEmployeeIntoEmployee'
)
BEGIN
    EXEC(N'
    UPDATE e
    SET e.ProductionLineId = p.ProductionLineId, e.TeamId = p.TeamId, e.ShiftTeamId = p.ShiftTeamId,
        e.CongDoan = p.CongDoan, e.TaskName = p.TaskName, e.IsLineLeader = p.IsLeader
    FROM Employees e
    JOIN ProductionEmployees p ON p.EmployeeId = e.Id
    WHERE p.IsDeleted = 0;');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109035255_MergeProductionEmployeeIntoEmployee'
)
BEGIN
    DROP TABLE [ProductionEmployees];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109035255_MergeProductionEmployeeIntoEmployee'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261109035255_MergeProductionEmployeeIntoEmployee', N'10.0.9');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109044448_RemoveEmployeeIsLineLeader'
)
BEGIN
    DECLARE @var nvarchar(max);
    SELECT @var = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Employees]') AND [c].[name] = N'IsLineLeader');
    IF @var IS NOT NULL EXEC(N'ALTER TABLE [Employees] DROP CONSTRAINT ' + @var + ';');
    ALTER TABLE [Employees] DROP COLUMN [IsLineLeader];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109044448_RemoveEmployeeIsLineLeader'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261109044448_RemoveEmployeeIsLineLeader', N'10.0.9');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109072502_MergeOtFormCreatorsIntoBorrowedApprovers'
)
BEGIN

    INSERT INTO GroupBorrowedApprovers (GroupId, EmployeeId)
    SELECT c.GroupId, c.EmployeeId
    FROM GroupOtFormCreators c
    JOIN Employees e ON e.Id = c.EmployeeId
    WHERE e.Code <> N'110892'
      AND NOT EXISTS (SELECT 1 FROM GroupBorrowedApprovers b WHERE b.GroupId = c.GroupId AND b.EmployeeId = c.EmployeeId);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109072502_MergeOtFormCreatorsIntoBorrowedApprovers'
)
BEGIN
    DROP TABLE [GroupOtFormCreators];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109072502_MergeOtFormCreatorsIntoBorrowedApprovers'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261109072502_MergeOtFormCreatorsIntoBorrowedApprovers', N'10.0.9');
END;

COMMIT;
GO


-- Attendance DB: overnight OT + paper scan, and per-level approver lists (GroupApprovalStepMembers) seeded from today's job-title holders.
-- Covers every migration after 20261105015300, so it is safe whether or not attendance-merge-production-staff.sql already ran; safe to re-run.
-- Back up first; run before deploying the matching build (the old build keeps working on the new schema).
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

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109095109_AddOvernightOtAndPaperScan'
)
BEGIN
    ALTER TABLE [OtFormEmployees] ADD [LedgerHoursNextMonth] decimal(10,2) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109095109_AddOvernightOtAndPaperScan'
)
BEGIN
    ALTER TABLE [OtFormApprovalHistories] ADD [IsPaperApproval] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109095109_AddOvernightOtAndPaperScan'
)
BEGIN
    CREATE TABLE [OtFormPaperScans] (
        [Id] int NOT NULL IDENTITY,
        [OtFormId] int NOT NULL,
        [FileName] nvarchar(255) NOT NULL,
        [ContentType] nvarchar(100) NOT NULL,
        [FileContent] varbinary(max) NOT NULL,
        [UploadedByUserName] nvarchar(100) NOT NULL,
        [UploadedByFullName] nvarchar(255) NULL,
        [UploadedAt] datetime2 NOT NULL,
        [Status] int NOT NULL,
        [ReviewedByUserName] nvarchar(100) NULL,
        [ReviewedByFullName] nvarchar(255) NULL,
        [ReviewedAt] datetime2 NULL,
        [ReviewComment] nvarchar(500) NULL,
        CONSTRAINT [PK_OtFormPaperScans] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_OtFormPaperScans_OtForms_OtFormId] FOREIGN KEY ([OtFormId]) REFERENCES [OtForms] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109095109_AddOvernightOtAndPaperScan'
)
BEGIN
    CREATE UNIQUE INDEX [IX_OtFormPaperScans_OtFormId] ON [OtFormPaperScans] ([OtFormId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261109095109_AddOvernightOtAndPaperScan'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261109095109_AddOvernightOtAndPaperScan', N'10.0.9');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110082803_AddGroupLevelMembers'
)
BEGIN
    ALTER TABLE [OtFormApprovalStepCandidates] ADD [ReceivesMail] bit NOT NULL DEFAULT CAST(1 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110082803_AddGroupLevelMembers'
)
BEGIN
    ALTER TABLE [Groups] ADD [CreatorMustSign] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110082803_AddGroupLevelMembers'
)
BEGIN
    CREATE TABLE [GroupApprovalStepMembers] (
        [Id] int NOT NULL IDENTITY,
        [GroupApprovalStepId] int NOT NULL,
        [EmployeeId] int NOT NULL,
        [ReceivesMail] bit NOT NULL,
        CONSTRAINT [PK_GroupApprovalStepMembers] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_GroupApprovalStepMembers_Employees_EmployeeId] FOREIGN KEY ([EmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_GroupApprovalStepMembers_GroupApprovalSteps_GroupApprovalStepId] FOREIGN KEY ([GroupApprovalStepId]) REFERENCES [GroupApprovalSteps] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110082803_AddGroupLevelMembers'
)
BEGIN
    CREATE INDEX [IX_GroupApprovalStepMembers_EmployeeId] ON [GroupApprovalStepMembers] ([EmployeeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110082803_AddGroupLevelMembers'
)
BEGIN
    CREATE UNIQUE INDEX [IX_GroupApprovalStepMembers_GroupApprovalStepId_EmployeeId] ON [GroupApprovalStepMembers] ([GroupApprovalStepId], [EmployeeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110082803_AddGroupLevelMembers'
)
BEGIN

    INSERT INTO GroupApprovalStepMembers (GroupApprovalStepId, EmployeeId, ReceivesMail)
    SELECT s.Id, e.Id, 1
    FROM GroupApprovalSteps s
    JOIN Employees e ON e.JobTitleId = s.JobTitleId
    WHERE s.IsDeleted = 0 AND e.IsDeleted = 0 AND e.UserName IS NOT NULL
      AND (e.GroupId = s.GroupId
           OR EXISTS (SELECT 1 FROM GroupBorrowedApprovers b WHERE b.GroupId = s.GroupId AND b.EmployeeId = e.Id));
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110082803_AddGroupLevelMembers'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261110082803_AddGroupLevelMembers', N'10.0.9');
END;

COMMIT;
GO


-- Read-only checks after the run: lent people whose title has no level in that Group (they can no longer create there; Admin re-adds them to a level).
SELECT g.GroupNameVn AS Nhom, e.Code, e.LastName + N' ' + e.FirstName AS Ten, j.Name AS ChucVu
FROM GroupBorrowedApprovers l JOIN Employees e ON e.Id = l.EmployeeId JOIN Groups g ON g.Id = l.GroupId LEFT JOIN JobTitles j ON j.Id = e.JobTitleId
WHERE e.IsDeleted = 0 AND e.UserName IS NOT NULL AND ISNULL(e.GroupId, 0) <> l.GroupId
  AND NOT EXISTS (SELECT 1 FROM GroupApprovalSteps s WHERE s.GroupId = l.GroupId AND s.IsDeleted = 0 AND s.JobTitleId = e.JobTitleId);

-- Levels left without anyone (forms skip them; Admin fills or removes them before saving that tree).
SELECT g.GroupNameVn AS Nhom, j.Name AS Cap
FROM GroupApprovalSteps s JOIN Groups g ON g.Id = s.GroupId JOIN JobTitles j ON j.Id = s.JobTitleId
WHERE s.IsDeleted = 0 AND g.IsDeleted = 0 AND NOT EXISTS (SELECT 1 FROM GroupApprovalStepMembers m WHERE m.GroupApprovalStepId = s.Id);

SELECT TOP 3 MigrationId FROM __EFMigrationsHistory ORDER BY MigrationId DESC;

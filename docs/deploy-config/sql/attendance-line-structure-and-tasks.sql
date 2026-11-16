BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261111041128_SnapshotEmployeeOtHourLimitOnForm'
)
BEGIN
    ALTER TABLE [OtFormEmployees] ADD [CustomMonthlyOtHourLimitSnapshot] decimal(10,2) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261111041128_SnapshotEmployeeOtHourLimitOnForm'
)
BEGIN
    ALTER TABLE [OtFormEmployees] ADD [CustomYearlyOtHourLimitSnapshot] decimal(10,2) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261111041128_SnapshotEmployeeOtHourLimitOnForm'
)
BEGIN
    EXEC(N'
    UPDATE fe SET CustomMonthlyOtHourLimitSnapshot = e.CustomMonthlyOtHourLimit, CustomYearlyOtHourLimitSnapshot = e.CustomYearlyOtHourLimit
    FROM OtFormEmployees fe JOIN Employees e ON e.Id = fe.EmployeeId
    WHERE e.CustomMonthlyOtHourLimit IS NOT NULL OR e.CustomYearlyOtHourLimit IS NOT NULL')
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261111041128_SnapshotEmployeeOtHourLimitOnForm'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261111041128_SnapshotEmployeeOtHourLimitOnForm', N'10.0.9');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112042428_GroupLineAndShift'
)
BEGIN
    ALTER TABLE [Groups] ADD [ProductionLineId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112042428_GroupLineAndShift'
)
BEGIN
    ALTER TABLE [Groups] ADD [ShiftTeamId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112042428_GroupLineAndShift'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_Groups_LineShift] ON [Groups] ([ProductionLineId], [ShiftTeamId]) WHERE [ProductionLineId] IS NOT NULL AND [IsDeleted] = 0');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112042428_GroupLineAndShift'
)
BEGIN
    CREATE INDEX [IX_Groups_ShiftTeamId] ON [Groups] ([ShiftTeamId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112042428_GroupLineAndShift'
)
BEGIN
    ALTER TABLE [Groups] ADD CONSTRAINT [FK_Groups_ProductionLines_ProductionLineId] FOREIGN KEY ([ProductionLineId]) REFERENCES [ProductionLines] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112042428_GroupLineAndShift'
)
BEGIN
    ALTER TABLE [Groups] ADD CONSTRAINT [FK_Groups_ProductionShiftTeams_ShiftTeamId] FOREIGN KEY ([ShiftTeamId]) REFERENCES [ProductionShiftTeams] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112042428_GroupLineAndShift'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261112042428_GroupLineAndShift', N'10.0.9');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113005917_GroupLineKind'
)
BEGIN
    DROP INDEX [IX_Groups_LineShift] ON [Groups];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113005917_GroupLineKind'
)
BEGIN
    ALTER TABLE [Groups] ADD [LineKind] nvarchar(20) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113005917_GroupLineKind'
)
BEGIN
    CREATE INDEX [IX_Groups_ProductionLineId] ON [Groups] ([ProductionLineId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113005917_GroupLineKind'
)
BEGIN

    WITH g AS (
        SELECT Id,
            ' ' + REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                UPPER(GroupNameVn), '-', ' '), '_', ' '), '.', ' '), N'·', ' '), '(', ' '), ')', ' '),
                '   ', ' '), '  ', ' '), '  ', ' '), 'LINE A0', 'LINE A'), 'LINE B0', 'LINE B') + ' ' AS n
        FROM Groups WHERE IsDeleted = 0 AND ProductionLineId IS NULL
    ), m AS (
        SELECT g.Id, l.Id AS LineId, RANK() OVER (PARTITION BY g.Id ORDER BY LEN(l.LineCode) DESC) AS rk
        FROM g JOIN ProductionLines l ON l.IsDeleted = 0
        CROSS APPLY (SELECT ' ' + REPLACE(REPLACE(UPPER(LTRIM(RTRIM(l.LineCode))), '-', ' '), '_', ' ') + ' ' AS t) tok
        WHERE g.n LIKE '% LINE' + tok.t + '%' OR g.n LIKE '% BLOCK' + tok.t + '%'
           OR (LEN(LTRIM(RTRIM(l.LineCode))) >= 3 AND g.n LIKE '%' + tok.t + '%')
    ), one AS (
        SELECT Id, MIN(LineId) AS LineId FROM m WHERE rk = 1 GROUP BY Id HAVING COUNT(*) = 1
    ), parsed AS (
        SELECT g.Id, one.LineId,
            CASE WHEN g.n LIKE '% GREEN %' THEN 'G' WHEN g.n LIKE '% ORANGE %' THEN 'O' END AS Ca,
            CASE WHEN g.n LIKE '% GT %' THEN 'GT' WHEN g.n LIKE '% TT %' THEN 'TT' END AS Kind
        FROM g JOIN one ON one.Id = g.Id
    )
    UPDATE gr SET ProductionLineId = p.LineId, ShiftTeamId = s.Id, LineKind = p.Kind
    FROM Groups gr
    JOIN parsed p ON p.Id = gr.Id
    JOIN ProductionShiftTeams s ON s.IsDeleted = 0 AND LTRIM(RTRIM(s.Code)) = p.Ca;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113005917_GroupLineKind'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261113005917_GroupLineKind', N'10.0.9');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    ALTER TABLE [ProductionTeams] ADD [WorkshopId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    ALTER TABLE [ProductionLines] ADD [WorkshopId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    DECLARE @var nvarchar(max);
    SELECT @var = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ProductionLines]') AND [c].[name] = N'TeamId');
    IF @var IS NOT NULL EXEC(N'ALTER TABLE [ProductionLines] DROP CONSTRAINT ' + @var + ';');
    ALTER TABLE [ProductionLines] ALTER COLUMN [TeamId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    ALTER TABLE [ProductionLines] ADD [CdMae] nvarchar(50) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    ALTER TABLE [ProductionLines] ADD [SortCode] nvarchar(50) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    ALTER TABLE [ProductionLines] ADD [HasDirectStaff] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    ALTER TABLE [ProductionLines] ADD [HasIndirectStaff] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    ALTER TABLE [Employees] ADD [StaffKind] nvarchar(20) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    CREATE TABLE [GroupLines] (
        [Id] int NOT NULL IDENTITY,
        [GroupId] int NOT NULL,
        [ProductionLineId] int NOT NULL,
        [ShiftTeamId] int NOT NULL,
        CONSTRAINT [PK_GroupLines] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_GroupLines_Groups_GroupId] FOREIGN KEY ([GroupId]) REFERENCES [Groups] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_GroupLines_ProductionLines_ProductionLineId] FOREIGN KEY ([ProductionLineId]) REFERENCES [ProductionLines] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_GroupLines_ProductionShiftTeams_ShiftTeamId] FOREIGN KEY ([ShiftTeamId]) REFERENCES [ProductionShiftTeams] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN

    DECLARE @da int = (SELECT TOP 1 Id FROM Workshops WHERE WorkshopCode = N'DA' AND IsDeleted = 0 ORDER BY Id);
    IF @da IS NULL SET @da = (SELECT MIN(Id) FROM Workshops WHERE IsDeleted = 0);
    UPDATE ProductionTeams SET WorkshopId = @da;
    UPDATE ProductionLines SET WorkshopId = @da;

    DECLARE @src TABLE (Fac nvarchar(50), LineCode nvarchar(50), TeamCode nvarchar(20) NULL, CongDoan nvarchar(50) NULL,
        CdMae nvarchar(50) NULL, SortCode nvarchar(50) NULL, Tt bit, Gt bit);
    INSERT @src VALUES
    (N'DA', N'A1', N'1', N'ATO', N'C', N'A01', 1, 1),
    (N'DA', N'A2', N'1', N'ATO', N'C', N'A02', 1, 1),
    (N'DA', N'A3', N'1', N'ATO', N'C', N'A03', 1, 1),
    (N'DA', N'A4', N'1', N'ATO', N'C', N'A04', 1, 1),
    (N'DA', N'A5', N'1', N'ATO', N'F', N'A05', 1, 1),
    (N'DA', N'A6', N'1', N'ATO', N'C', N'A06', 1, 1),
    (N'DA', N'A7', N'1', N'ATO', N'F', N'A07', 1, 1),
    (N'DA', N'A8', N'1', N'ATO', N'F', N'A08', 1, 1),
    (N'DA', N'A9', N'1', N'ATO', N'E', N'A09', 1, 1),
    (N'DA', N'A10', N'1', N'ATO', N'E', N'A10', 1, 1),
    (N'DA', N'A100', N'4', N'ATO', N'HM-A', N'A100', 1, 1),
    (N'DA', N'A11', N'1', N'ATO', N'E', N'A11', 1, 1),
    (N'DA', N'A12', N'1', N'ATO', N'E', N'A12', 1, 1),
    (N'DA', N'A15', N'1', N'ATO', N'E', N'A15', 1, 1),
    (N'DA', N'A15-CELL', N'1', N'ATO', N'E', N'A15C', 1, 1),
    (N'DA', N'A17', N'1', N'ATO', N'E', N'A17', 1, 1),
    (N'DA', N'A18', N'1', N'ATO', N'E', N'A18', 1, 1),
    (N'DA', N'A18-CELL', N'1', N'ATO', N'E', N'A18C', 1, 1),
    (N'DA', N'B1', N'2', N'ATO', N'R', N'B01', 1, 1),
    (N'DA', N'B2', N'2', N'ATO', N'R', N'B02', 1, 1),
    (N'DA', N'B3', N'2', N'ATO', N'R', N'B03', 1, 1),
    (N'DA', N'B4', N'2', N'ATO', N'R', N'B04', 1, 1),
    (N'DA', N'B5', N'2', N'ATO', N'R', N'B05', 1, 1),
    (N'DA', N'B6', N'2', N'ATO', N'R', N'B06', 1, 1),
    (N'DA', N'B7', N'2', N'ATO', N'V', N'B07', 1, 1),
    (N'DA', N'B8', N'2', N'ATO', N'V', N'B08', 1, 1),
    (N'DA', N'B10', N'2', N'ATO', N'V', N'B10', 1, 1),
    (N'DA', N'B100', N'4', N'ATO', N'HM-B', N'B100', 1, 1),
    (N'DA', N'B11', N'2', N'ATO', N'V', N'B11', 1, 1),
    (N'DA', N'B12', N'2', N'ATO', N'V', N'B12', 1, 1),
    (N'DA', N'B13', N'2', N'ATO', N'V', N'B13', 1, 1),
    (N'DA', N'B16', N'2', N'ATO', N'V', N'B16', 1, 1),
    (N'DA', N'B17', N'2', N'ATO', N'V', N'B17', 1, 1),
    (N'DA', N'B20', N'1', N'ATO', N'E', N'B20', 1, 1),
    (N'DA', N'BN-A', N'1', N'ATO', NULL, N'BN-A', 1, 1),
    (N'DA', N'BN-A1', N'1', N'ATO', NULL, N'BN-A1', 1, 1),
    (N'DA', N'BN-A2', N'1', N'ATO', NULL, N'BN-A2', 1, 1),
    (N'DA', N'BN-B', N'2', N'ATO', NULL, N'BN-B', 1, 1),
    (N'DA', N'BN-B1', N'2', N'ATO', NULL, N'BN-B1', 1, 1),
    (N'DA', N'BN-B2', N'2', N'ATO', NULL, N'BN-B2', 1, 1),
    (N'DA', N'BN-S', N'1', N'ATO', NULL, N'BN-S', 1, 1),
    (N'DA', N'C', N'1', N'MAE', NULL, N'C', 1, 1),
    (N'DA', N'COTTING-MAE', N'Mini', N'MAE', NULL, N'COT-M', 1, 0),
    (N'DA', N'COTTING-ATO', N'Mini', N'ATO', NULL, N'COT-A', 1, 0),
    (N'DA', N'DA', N'2', N'MAE', N'JK', N'DA', 0, 1),
    (N'DA', N'DBA', N'1', N'ATO', NULL, N'DBA', 0, 1),
    (N'DA', N'DBA1', N'1', N'ATO', NULL, N'DBA1', 0, 1),
    (N'DA', N'DBA2', N'1', N'ATO', NULL, N'DBA2', 0, 1),
    (N'DA', N'DBB', N'2', N'ATO', NULL, N'DBB', 0, 1),
    (N'DA', N'DBB1', N'2', N'ATO', NULL, N'DBB1', 0, 1),
    (N'DA', N'DBB2', N'2', N'ATO', NULL, N'DBB2', 0, 1),
    (N'DA', N'DBHT-A', N'1', N'ATO', NULL, N'DBHT-A', 0, 1),
    (N'DA', N'DBHT-A1', N'1', N'ATO', NULL, N'DBHT-A1', 0, 1),
    (N'DA', N'DBHT-A2', N'1', N'ATO', NULL, N'DBHT-A2', 0, 1),
    (N'DA', N'DBHT-B', N'2', N'ATO', NULL, N'DBHT-B', 0, 1),
    (N'DA', N'DBHT-B1', N'2', N'ATO', NULL, N'DBHT-B1', 0, 1),
    (N'DA', N'DBHT-B2', N'2', N'ATO', NULL, N'DBHT-B2', 0, 1),
    (N'DA', N'DBHT-S', N'1', N'ATO', NULL, N'DBHT-S', 0, 1),
    (N'DA', N'DBS', N'1', N'ATO', NULL, N'DBS', 0, 1),
    (N'DA', N'E', N'1', N'MAE', NULL, N'E', 1, 1),
    (N'DA', N'F', N'1', N'MAE', NULL, N'F', 1, 1),
    (N'DA', N'JK', N'2', N'MAE', NULL, N'JK', 1, 1),
    (N'DA', N'JKC', N'1', N'MAE', N'E', N'JKC', 1, 1),
    (N'DA', N'JKE', N'1', N'MAE', N'E', N'JKE', 1, 1),
    (N'DA', N'JKF', N'1', N'MAE', N'F', N'JKF', 1, 1),
    (N'DA', N'JKR', N'2', N'MAE', N'R', N'JKR', 1, 1),
    (N'DA', N'JKV', N'2', N'MAE', N'V', N'JKV', 1, 1),
    (N'MP', N'MP-24', N'1', N'MAE', N'C', N'MP-24', 1, 1),
    (N'MP', N'MP-3', N'1', N'MAE', N'C', N'MP-3', 1, 1),
    (N'MP', N'MP-5', N'1', N'MAE', N'C', N'MP-5', 1, 1),
    (N'DA', N'OS', N'2', N'MAE', NULL, N'OS', 1, 1),
    (N'DA', N'R', N'2', N'MAE', NULL, N'R', 1, 1),
    (N'DA', N'TKS', N'1', N'MAE', NULL, N'TKS', 1, 1),
    (N'TV', N'TV-5', N'2', N'MAE', N'JK', N'TV-5', 1, 1),
    (N'TV', N'TV-A17', N'2', N'MAE', N'JK', N'TV-A17', 1, 1),
    (N'TV', N'TV-A18', N'2', N'MAE', N'JK', N'TV-A18', 1, 1),
    (N'DA', N'V', N'2', N'MAE', NULL, N'V', 1, 1),
    (N'DA', N'HM-A', N'4', N'MAE', NULL, N'HM-A', 1, 1),
    (N'DA', N'HM-B', N'4', N'MAE', NULL, N'HM-B', 1, 1),
    (N'DA', N'BO-A', N'4', N'MAE', NULL, N'BO-A', 1, 1),
    (N'DA', N'BO-B', N'4', N'MAE', NULL, N'BO-B', 1, 1),
    (N'DA', N'A200', N'4', N'ATO', N'BO-A', N'A200', 1, 1),
    (N'DA', N'B200', N'4', N'ATO', N'BO-B', N'B200', 1, 1),
    (N'DA', N'DHCL', NULL, N'ATO', NULL, N'DHCL', 0, 1),
    (N'DA', N'CNM', NULL, N'GT AB', NULL, N'CNM', 0, 1),
    (N'DA', N'CNM_A', NULL, N'GT AB', NULL, N'CNM_A', 0, 1),
    (N'DA', N'CNM_M', NULL, N'GT AB', NULL, N'CNM_M', 0, 1),
    (N'DA', N'CNM-KSU-A', NULL, N'GT AB', NULL, N'CNM-KSU-A', 0, 1),
    (N'DA', N'CNM-KSU-B', NULL, N'GT AB', NULL, N'CNM-KSU-B', 0, 1),
    (N'DA', N'CNM-KSU-M', NULL, N'GT AB', NULL, N'CNM-KSU-M', 0, 1),
    (N'DA', N'ĐN-A', NULL, N'GT AB', NULL, N'ĐN-A', 0, 1),
    (N'DA', N'ĐN-B', NULL, N'GT AB', NULL, N'ĐN-B', 0, 1),
    (N'DA', N'ĐN-S', NULL, N'GT AB', NULL, N'ĐN-S', 0, 1),
    (N'DA', N'HL', NULL, N'GT AB', NULL, N'HL', 0, 1),
    (N'DA', N'HL1', NULL, N'GT AB', NULL, N'HL1', 0, 1),
    (N'DA', N'JAPAN', NULL, N'GT AB', NULL, N'JAPAN', 0, 1),
    (N'DA', N'KHO', N'Mini', N'GT AB', NULL, N'KHO', 0, 1),
    (N'DA', N'KSU', NULL, N'GT AB', NULL, N'KSU', 0, 1),
    (N'DA', N'LC-A', NULL, N'GT AB', NULL, N'LC-A', 0, 1),
    (N'DA', N'LC-B', NULL, N'GT AB', NULL, N'LC-B', 0, 1),
    (N'DA', N'LD', NULL, N'GT AB', NULL, N'LD', 0, 1),
    (N'DA', N'LQC-A', NULL, N'GT AB', NULL, N'LQC-A', 0, 1),
    (N'DA', N'LQC-M', NULL, N'GT AB', NULL, N'LQC-M', 0, 1),
    (N'DA', N'TC', NULL, N'GT AB', NULL, N'TC', 0, 1),
    (N'DA', N'TCA', NULL, N'GT AB', NULL, N'TCA', 0, 1),
    (N'DA', N'TCB', NULL, N'GT AB', NULL, N'TCB', 0, 1),
    (N'DA', N'TCM', NULL, N'GT AB', NULL, N'TCM', 0, 1),
    (N'DA', N'Tenaoshi', NULL, N'GT AB', NULL, N'Tenaoshi', 0, 1),
    (N'DA', N'4S', NULL, N'GT B', NULL, N'4S', 0, 1),
    (N'DA', N'KZ-A', NULL, N'GT B', NULL, N'APO-A', 0, 1),
    (N'DA', N'KZ-B', NULL, N'GT B', NULL, N'APO-B', 0, 1),
    (N'DA', N'KZ-M', NULL, N'GT B', NULL, N'APO-M', 0, 1),
    (N'DA', N'CT', NULL, N'GT B', NULL, N'CT', 0, 1),
    (N'DA', N'CTCD', NULL, N'GT B', NULL, N'CTCD', 0, 1),
    (N'DA', N'KANBAN', NULL, N'GT B', NULL, N'KANBAN', 0, 1),
    (N'DA', N'KANBAN-MAE', NULL, N'GT B', NULL, N'KANBAN-MAE', 0, 1),
    (N'DA', N'KANBAN-NVL', N'Mini', N'GT B', NULL, N'KANBAN-NVL', 0, 1),
    (N'DA', N'KZ', NULL, N'GT B', NULL, N'KZ', 0, 1),
    (N'DA', N'MAU', NULL, N'GT B', NULL, N'MAU', 0, 1),
    (N'DA', N'QA', NULL, N'GT B', NULL, N'QA', 0, 1),
    (N'DA', N'SHIDO', NULL, N'GT B', NULL, N'SHIDO', 0, 1),
    (N'DA', N'TQM', NULL, N'GT B', NULL, N'TQM', 0, 1),
    (N'DA', N'KTNV', NULL, N'GT AB', NULL, N'KTNV', 0, 1),
    (N'DA', N'SHIPPING', NULL, N'GT AB', NULL, N'SHIPPING', 0, 1);

    INSERT ProductionTeams (Code, NameVn, IsDeleted, WorkshopId)
    SELECT DISTINCT s.TeamCode, NULL, 0, w.Id FROM @src s JOIN Workshops w ON w.WorkshopCode = s.Fac AND w.IsDeleted = 0
    WHERE s.TeamCode IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ProductionTeams t WHERE t.WorkshopId = w.Id AND t.Code = s.TeamCode AND t.IsDeleted = 0);

    UPDATE l SET l.LineCode = s.LineCode, l.TeamId = t.Id, l.CongDoan = s.CongDoan, l.CdMae = s.CdMae, l.SortCode = s.SortCode,
        l.HasDirectStaff = s.Tt, l.HasIndirectStaff = s.Gt
    FROM ProductionLines l JOIN Workshops w ON w.Id = l.WorkshopId JOIN @src s ON s.Fac = w.WorkshopCode AND s.LineCode = l.LineCode
    LEFT JOIN ProductionTeams t ON t.WorkshopId = w.Id AND t.Code = s.TeamCode AND t.IsDeleted = 0
    WHERE l.IsDeleted = 0;

    INSERT ProductionLines (LineCode, TeamId, CongDoan, IsDeleted, WorkshopId, CdMae, SortCode, HasDirectStaff, HasIndirectStaff)
    SELECT s.LineCode, t.Id, s.CongDoan, 0, w.Id, s.CdMae, s.SortCode, s.Tt, s.Gt
    FROM @src s JOIN Workshops w ON w.WorkshopCode = s.Fac AND w.IsDeleted = 0
    LEFT JOIN ProductionTeams t ON t.WorkshopId = w.Id AND t.Code = s.TeamCode AND t.IsDeleted = 0
    WHERE NOT EXISTS (SELECT 1 FROM ProductionLines l WHERE l.WorkshopId = w.Id AND l.LineCode = s.LineCode AND l.IsDeleted = 0);

    -- Lines missing from the file are retired unless someone still uses them.
    UPDATE l SET IsDeleted = 1 FROM ProductionLines l JOIN Workshops w ON w.Id = l.WorkshopId
    WHERE l.IsDeleted = 0 AND NOT EXISTS (SELECT 1 FROM @src s WHERE s.Fac = w.WorkshopCode AND s.LineCode = l.LineCode)
        AND NOT EXISTS (SELECT 1 FROM Employees e WHERE e.ProductionLineId = l.Id AND e.IsDeleted = 0)
        AND NOT EXISTS (SELECT 1 FROM Groups g WHERE g.ProductionLineId = l.Id AND g.IsDeleted = 0);
    UPDATE l SET TeamId = NULL FROM ProductionLines l JOIN ProductionTeams t ON t.Id = l.TeamId
    WHERE NOT EXISTS (SELECT 1 FROM @src s JOIN Workshops w ON w.WorkshopCode = s.Fac WHERE w.Id = t.WorkshopId AND s.TeamCode = t.Code);
    UPDATE ProductionLines SET HasDirectStaff = 1, HasIndirectStaff = 1 WHERE IsDeleted = 0 AND HasDirectStaff = 0 AND HasIndirectStaff = 0;

    UPDATE e SET TeamId = l.TeamId FROM Employees e JOIN ProductionLines l ON l.Id = e.ProductionLineId;
    UPDATE Employees SET TeamId = NULL WHERE ProductionLineId IS NULL AND TeamId IS NOT NULL;
    UPDATE t SET IsDeleted = 1 FROM ProductionTeams t WHERE t.IsDeleted = 0
        AND NOT EXISTS (SELECT 1 FROM @src s JOIN Workshops w ON w.WorkshopCode = s.Fac WHERE w.Id = t.WorkshopId AND s.TeamCode = t.Code);

    INSERT GroupLines (GroupId, ProductionLineId, ShiftTeamId)
    SELECT Id, ProductionLineId, ShiftTeamId FROM Groups WHERE IsDeleted = 0 AND ProductionLineId IS NOT NULL AND ShiftTeamId IS NOT NULL;
    UPDATE g SET LineKind = CASE WHEN l.HasDirectStaff = 1 AND l.HasIndirectStaff = 0 THEN N'TT' WHEN l.HasDirectStaff = 0 AND l.HasIndirectStaff = 1 THEN N'GT' END
    FROM Groups g JOIN ProductionLines l ON l.Id = g.ProductionLineId WHERE g.LineKind IS NULL AND g.IsDeleted = 0;

    UPDATE e SET StaffKind = COALESCE(
        CASE WHEN l.HasDirectStaff = 1 AND l.HasIndirectStaff = 0 THEN N'TT' WHEN l.HasDirectStaff = 0 AND l.HasIndirectStaff = 1 THEN N'GT' END,
        CASE WHEN g.LineKind = N'TT' AND l.HasDirectStaff = 1 THEN N'TT' WHEN g.LineKind = N'GT' AND l.HasIndirectStaff = 1 THEN N'GT' END)
    FROM Employees e JOIN ProductionLines l ON l.Id = e.ProductionLineId LEFT JOIN Groups g ON g.Id = e.GroupId;

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    ALTER TABLE [Groups] DROP CONSTRAINT [FK_Groups_ProductionLines_ProductionLineId];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    ALTER TABLE [Groups] DROP CONSTRAINT [FK_Groups_ProductionShiftTeams_ShiftTeamId];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    DROP INDEX [IX_Groups_ProductionLineId] ON [Groups];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    DROP INDEX [IX_Groups_ShiftTeamId] ON [Groups];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    DECLARE @var1 nvarchar(max);
    SELECT @var1 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Groups]') AND [c].[name] = N'ProductionLineId');
    IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [Groups] DROP CONSTRAINT ' + @var1 + ';');
    ALTER TABLE [Groups] DROP COLUMN [ProductionLineId];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    DECLARE @var2 nvarchar(max);
    SELECT @var2 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Groups]') AND [c].[name] = N'ShiftTeamId');
    IF @var2 IS NOT NULL EXEC(N'ALTER TABLE [Groups] DROP CONSTRAINT ' + @var2 + ';');
    ALTER TABLE [Groups] DROP COLUMN [ShiftTeamId];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    DECLARE @var3 nvarchar(max);
    SELECT @var3 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ProductionTeams]') AND [c].[name] = N'WorkshopId');
    IF @var3 IS NOT NULL EXEC(N'ALTER TABLE [ProductionTeams] DROP CONSTRAINT ' + @var3 + ';');
    ALTER TABLE [ProductionTeams] ALTER COLUMN [WorkshopId] int NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    DECLARE @var4 nvarchar(max);
    SELECT @var4 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ProductionLines]') AND [c].[name] = N'WorkshopId');
    IF @var4 IS NOT NULL EXEC(N'ALTER TABLE [ProductionLines] DROP CONSTRAINT ' + @var4 + ';');
    ALTER TABLE [ProductionLines] ALTER COLUMN [WorkshopId] int NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_ProductionTeams_WorkshopId_Code] ON [ProductionTeams] ([WorkshopId], [Code]) WHERE [IsDeleted] = 0');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_ProductionLines_WorkshopId_LineCode] ON [ProductionLines] ([WorkshopId], [LineCode]) WHERE [IsDeleted] = 0');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    CREATE UNIQUE INDEX [IX_GroupLines_GroupId_ProductionLineId_ShiftTeamId] ON [GroupLines] ([GroupId], [ProductionLineId], [ShiftTeamId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    CREATE INDEX [IX_GroupLines_ProductionLineId] ON [GroupLines] ([ProductionLineId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    CREATE INDEX [IX_GroupLines_ShiftTeamId] ON [GroupLines] ([ShiftTeamId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    ALTER TABLE [ProductionLines] ADD CONSTRAINT [FK_ProductionLines_Workshops_WorkshopId] FOREIGN KEY ([WorkshopId]) REFERENCES [Workshops] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    ALTER TABLE [ProductionTeams] ADD CONSTRAINT [FK_ProductionTeams_Workshops_WorkshopId] FOREIGN KEY ([WorkshopId]) REFERENCES [Workshops] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113064522_LineStructureByWorkshop'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261113064522_LineStructureByWorkshop', N'10.0.9');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113065132_GroupLinesForEveryone'
)
BEGIN

    -- Groups whose name points at a catalog line (ones already seen on dev); the rest fall back to a line named after the group.
    DECLARE @map TABLE (GroupCode nvarchar(50), LineCode nvarchar(50));
    INSERT @map VALUES
    (N'1A4AP', N'CNM'),
    (N'1P4CK', N'KANBAN'),
    (N'AP1', N'CNM'),
    (N'AP2', N'CNM'),
    (N'AP3', N'CNM'),
    (N'1I4PKZA', N'KZ-A'),
    (N'1I4PKZB', N'KZ-B'),
    (N'1I4PKZM', N'KZ-M'),
    (N'1I4PKM', N'KANBAN-MAE'),
    (N'1D1PRBNA', N'BN-A'),
    (N'1I1PRBNA1', N'BN-A1'),
    (N'1D1PRBNA1', N'BN-A1'),
    (N'1I2PRBNA1', N'BN-A1'),
    (N'1D2PRBNA1', N'BN-A1'),
    (N'1D1PRBNS', N'BN-S'),
    (N'1D2PRBNS', N'BN-S'),
    (N'1D1PRBNB', N'BN-B'),
    (N'1P4PP', N'CNM'),
    (N'1I2PRDBS', N'DBS'),
    (N'1P4PC', N'CNM'),
    (N'1I1PRBOS', N'OS'),
    (N'1D1PRBOS', N'OS'),
    (N'1I2PRBOS', N'OS'),
    (N'1D2PRBOS', N'OS'),
    (N'1P4PKTQM', N'TQM'),
    (N'1I4PRTCA', N'TC'),
    (N'1I1PRTCA', N'TCA'),
    (N'1I2PRTCA', N'TCA'),
    (N'1I1PRTCB', N'TCB'),
    (N'1I2PRTCB', N'TCB'),
    (N'1I2PRDBA1H', N'DBHT-A1'),
    (N'1I2PRDBA2H', N'DBHT-A2'),
    (N'1I1PRDBB1H', N'DBHT-B1'),
    (N'1I2PRDBB1H', N'DBHT-B1'),
    (N'1I1PRDBB2H', N'DBHT-B2'),
    (N'1I2PRDBB2H', N'DBHT-B2'),
    (N'1I1PRDBA1', N'DBA1'),
    (N'1I2PRDBA1', N'DBA1'),
    (N'1I2PRDBA2', N'DBA2'),
    (N'1I1PRDBB1', N'DBB1'),
    (N'1I2PRDBB1', N'DBB1'),
    (N'1I1PRDBB2', N'DBB2'),
    (N'1I2PRDBB2', N'DBB2'),
    (N'1I1PRDBS', N'DBS'),
    (N'1I4PS', N'SHIDO'),
    (N'1I1QSDBA', N'DBA'),
    (N'1I2QSDBA', N'DBA'),
    (N'1I1QSDBB', N'DBB'),
    (N'1I2QSDBB', N'DBB'),
    (N'1I1QSALC', N'LC-A'),
    (N'1D1QDALC', N'LC-A'),
    (N'1I2QSALC', N'LC-A'),
    (N'1D2QDALC', N'LC-A'),
    (N'1D1QDLCB', N'LC-B'),
    (N'1I2QSLCB', N'LC-B'),
    (N'1D2QDLCB', N'LC-B'),
    (N'1P4QKM', N'MAU'),
    (N'1I1QSBOS', N'OS'),
    (N'1I2QSBOS', N'OS'),
    (N'1I1QSTCA', N'TCA'),
    (N'1I2QSTCA', N'TCA'),
    (N'1I1QSTCB', N'TCB'),
    (N'1I2QSTCB', N'TCB'),
    (N'1I1QSBLV', N'V'),
    (N'1I4QU', N'KTNV'),
    (N'1I3QT', N'Tenaoshi');

    DECLARE @hc int = (SELECT TOP 1 Id FROM ProductionShiftTeams WHERE Code = N'HC' AND IsDeleted = 0 ORDER BY Id);
    DECLARE @g TABLE (GroupId int PRIMARY KEY, WorkshopId int, DepartmentId int, Name nvarchar(255), NameKind nvarchar(20) NULL, ShiftId int, LineId int NULL);
    INSERT @g (GroupId, WorkshopId, DepartmentId, Name, NameKind, ShiftId)
    SELECT g.Id, g.WorkshopId, g.DepartmentId, g.GroupNameVn,
        CASE WHEN N' ' + REPLACE(g.GroupNameVn, N'-', N' ') + N' ' LIKE N'% TT %' THEN N'TT'
             WHEN N' ' + REPLACE(g.GroupNameVn, N'-', N' ') + N' ' LIKE N'% GT %' THEN N'GT' END,
        COALESCE(CASE WHEN g.GroupNameVn LIKE N'%GREEN%' THEN (SELECT TOP 1 Id FROM ProductionShiftTeams WHERE Code = N'G' AND IsDeleted = 0)
                      WHEN g.GroupNameVn LIKE N'%ORANGE%' THEN (SELECT TOP 1 Id FROM ProductionShiftTeams WHERE Code = N'O' AND IsDeleted = 0) END, @hc)
    FROM Groups g WHERE g.IsDeleted = 0 AND NOT EXISTS (SELECT 1 FROM GroupLines gl WHERE gl.GroupId = g.Id);

    UPDATE x SET LineId = l.Id FROM @g x JOIN Groups g ON g.Id = x.GroupId JOIN @map m ON m.GroupCode = g.GroupCode
    JOIN ProductionLines l ON l.WorkshopId = x.WorkshopId AND l.LineCode = m.LineCode AND l.IsDeleted = 0
    WHERE x.NameKind IS NULL OR (x.NameKind = N'TT' AND l.HasDirectStaff = 1) OR (x.NameKind = N'GT' AND l.HasIndirectStaff = 1);

    -- Fallback: Line = group name, team GT A, C_doan GT A, flags from the name's TT/GT (GT when absent).
    INSERT ProductionTeams (Code, NameVn, IsDeleted, WorkshopId)
    SELECT DISTINCT N'GT A', NULL, 0, x.WorkshopId FROM @g x
    WHERE x.LineId IS NULL AND NOT EXISTS (SELECT 1 FROM ProductionTeams t WHERE t.WorkshopId = x.WorkshopId AND t.Code = N'GT A' AND t.IsDeleted = 0);
    INSERT ProductionLines (LineCode, TeamId, CongDoan, IsDeleted, WorkshopId, CdMae, SortCode, HasDirectStaff, HasIndirectStaff)
    SELECT LEFT(x.Name, 50), (SELECT TOP 1 t.Id FROM ProductionTeams t WHERE t.WorkshopId = x.WorkshopId AND t.Code = N'GT A' AND t.IsDeleted = 0),
        N'GT A', 0, x.WorkshopId, NULL, NULL, MAX(CASE WHEN x.NameKind = N'TT' THEN 1 ELSE 0 END), MAX(CASE WHEN ISNULL(x.NameKind, N'GT') = N'GT' THEN 1 ELSE 0 END)
    FROM @g x WHERE x.LineId IS NULL
        AND NOT EXISTS (SELECT 1 FROM ProductionLines l WHERE l.WorkshopId = x.WorkshopId AND l.LineCode = LEFT(x.Name, 50) AND l.IsDeleted = 0)
    GROUP BY x.WorkshopId, LEFT(x.Name, 50);
    UPDATE x SET LineId = l.Id FROM @g x JOIN ProductionLines l ON l.WorkshopId = x.WorkshopId AND l.LineCode = LEFT(x.Name, 50) AND l.IsDeleted = 0
    WHERE x.LineId IS NULL;
    UPDATE l SET HasDirectStaff = 1 FROM ProductionLines l JOIN @g x ON x.LineId = l.Id WHERE x.NameKind = N'TT';
    UPDATE l SET HasIndirectStaff = 1 FROM ProductionLines l JOIN @g x ON x.LineId = l.Id WHERE ISNULL(x.NameKind, N'GT') = N'GT' AND l.CongDoan = N'GT A';

    INSERT GroupLines (GroupId, ProductionLineId, ShiftTeamId) SELECT GroupId, LineId, ShiftId FROM @g WHERE LineId IS NOT NULL;
    UPDATE g SET LineKind = x.NameKind FROM Groups g JOIN @g x ON x.GroupId = g.Id WHERE x.NameKind IS NOT NULL;

    -- Groups still without TT/GT: the line's only kind, else the kind most of the department's line groups have.
    UPDATE g SET LineKind = CASE WHEN l.HasDirectStaff = 1 AND l.HasIndirectStaff = 0 THEN N'TT' WHEN l.HasDirectStaff = 0 AND l.HasIndirectStaff = 1 THEN N'GT' END
    FROM Groups g CROSS APPLY (SELECT TOP 1 pl.* FROM GroupLines gl JOIN ProductionLines pl ON pl.Id = gl.ProductionLineId WHERE gl.GroupId = g.Id) l
    WHERE g.IsDeleted = 0 AND g.LineKind IS NULL;
    UPDATE g SET LineKind = ISNULL((SELECT TOP 1 o.LineKind FROM Groups o WHERE o.IsDeleted = 0 AND o.DepartmentId = g.DepartmentId AND o.LineKind IS NOT NULL
            GROUP BY o.LineKind ORDER BY COUNT(*) DESC, o.LineKind DESC), N'TT')
    FROM Groups g WHERE g.IsDeleted = 0 AND g.LineKind IS NULL AND EXISTS (SELECT 1 FROM GroupLines gl WHERE gl.GroupId = g.Id);

    -- Everyone in a group gets its Line × Ca when they have none; Office for the group-named lines.
    UPDATE e SET ProductionLineId = l.Id, ShiftTeamId = gl.ShiftTeamId, TeamId = l.TeamId,
        CongDoan = ISNULL(e.CongDoan, l.CongDoan), TaskName = ISNULL(e.TaskName, CASE WHEN l.CongDoan = N'GT A' THEN N'Office' END)
    FROM Employees e JOIN Groups g ON g.Id = e.GroupId
    CROSS APPLY (SELECT TOP 1 x.ProductionLineId, x.ShiftTeamId FROM GroupLines x WHERE x.GroupId = g.Id ORDER BY x.Id) gl
    JOIN ProductionLines l ON l.Id = gl.ProductionLineId
    WHERE e.IsDeleted = 0 AND e.ProductionLineId IS NULL;
    UPDATE e SET StaffKind = COALESCE(
        CASE WHEN g.LineKind = N'TT' AND l.HasDirectStaff = 1 THEN N'TT' WHEN g.LineKind = N'GT' AND l.HasIndirectStaff = 1 THEN N'GT' END,
        CASE WHEN l.HasDirectStaff = 1 AND l.HasIndirectStaff = 0 THEN N'TT' WHEN l.HasDirectStaff = 0 AND l.HasIndirectStaff = 1 THEN N'GT' END)
    FROM Employees e JOIN ProductionLines l ON l.Id = e.ProductionLineId LEFT JOIN Groups g ON g.Id = e.GroupId
    WHERE e.IsDeleted = 0 AND e.StaffKind IS NULL;

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113065132_GroupLinesForEveryone'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261113065132_GroupLinesForEveryone', N'10.0.9');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113072406_LineStructureFixes'
)
BEGIN

    -- Lines without a team (indirect lines) go to the workshop's GT A team until the owners fill the real one.
    INSERT ProductionTeams (Code, NameVn, IsDeleted, WorkshopId)
    SELECT DISTINCT N'GT A', NULL, 0, l.WorkshopId FROM ProductionLines l
    WHERE l.IsDeleted = 0 AND l.TeamId IS NULL
        AND NOT EXISTS (SELECT 1 FROM ProductionTeams t WHERE t.WorkshopId = l.WorkshopId AND t.Code = N'GT A' AND t.IsDeleted = 0);
    UPDATE l SET TeamId = t.Id FROM ProductionLines l JOIN ProductionTeams t ON t.WorkshopId = l.WorkshopId AND t.Code = N'GT A' AND t.IsDeleted = 0
    WHERE l.IsDeleted = 0 AND l.TeamId IS NULL;

    -- Groups whose HR name disagrees with their HR code (code: 1 + D/I = TT/GT + 1/2 = Green/Orange).
    UPDATE gl SET ProductionLineId = l.Id FROM GroupLines gl JOIN Groups g ON g.Id = gl.GroupId
    JOIN ProductionLines l ON l.WorkshopId = g.WorkshopId AND l.LineCode = N'BN-B2' AND l.IsDeleted = 0
    WHERE g.GroupCode = N'1D1PRBNB2' AND g.IsDeleted = 0;
    UPDATE Groups SET LineKind = N'GT' WHERE GroupCode = N'1I2PRB08' AND IsDeleted = 0;
    UPDATE gl SET ShiftTeamId = s.Id FROM GroupLines gl JOIN Groups g ON g.Id = gl.GroupId
    JOIN ProductionShiftTeams s ON s.Code = N'O' AND s.IsDeleted = 0
    WHERE g.GroupCode = N'1I2QSA01' AND g.IsDeleted = 0;
    UPDATE gl SET ProductionLineId = l.Id FROM GroupLines gl JOIN Groups g ON g.Id = gl.GroupId
    JOIN ProductionLines l ON l.WorkshopId = g.WorkshopId AND l.LineCode = N'B8' AND l.IsDeleted = 0
    WHERE g.GroupCode = N'1I2QSB08' AND g.IsDeleted = 0;

    -- The CNM groups of one department each get their own line (copy of CNM), named after the group.
    DECLARE @cnm TABLE (GroupId int, WorkshopId int, LineCode nvarchar(50), SourceLineId int);
    INSERT @cnm SELECT g.Id, g.WorkshopId,
        LEFT(CASE WHEN COUNT(*) OVER (PARTITION BY g.WorkshopId, g.GroupNameVn) > 1 THEN g.GroupNameVn + N' ' + g.GroupCode ELSE g.GroupNameVn END, 50), l.Id
    FROM Groups g JOIN GroupLines gl ON gl.GroupId = g.Id JOIN ProductionLines l ON l.Id = gl.ProductionLineId
    WHERE g.IsDeleted = 0 AND l.LineCode = N'CNM' AND g.GroupCode IN (N'1P4PC', N'AP1', N'AP2', N'AP3', N'1P4PP');
    INSERT ProductionLines (LineCode, TeamId, CongDoan, IsDeleted, WorkshopId, CdMae, SortCode, HasDirectStaff, HasIndirectStaff)
    SELECT c.LineCode, s.TeamId, s.CongDoan, 0, c.WorkshopId, s.CdMae, NULL, s.HasDirectStaff, s.HasIndirectStaff
    FROM @cnm c JOIN ProductionLines s ON s.Id = c.SourceLineId
    WHERE NOT EXISTS (SELECT 1 FROM ProductionLines l WHERE l.WorkshopId = c.WorkshopId AND l.LineCode = c.LineCode AND l.IsDeleted = 0);
    UPDATE gl SET ProductionLineId = l.Id FROM GroupLines gl JOIN @cnm c ON c.GroupId = gl.GroupId AND gl.ProductionLineId = c.SourceLineId
    JOIN ProductionLines l ON l.WorkshopId = c.WorkshopId AND l.LineCode = c.LineCode AND l.IsDeleted = 0;

    -- People with neither group nor management title go to the largest group of their department.
    UPDATE e SET GroupId = x.GroupId, DepartmentId = NULL
    FROM Employees e LEFT JOIN JobTitles j ON j.Id = e.JobTitleId
    CROSS APPLY (SELECT TOP 1 g.Id GroupId FROM Groups g WHERE g.IsDeleted = 0 AND g.DepartmentId = e.DepartmentId
        ORDER BY (SELECT COUNT(*) FROM Employees m WHERE m.GroupId = g.Id AND m.IsDeleted = 0) DESC, g.Id) x
    WHERE e.IsDeleted = 0 AND e.GroupId IS NULL AND e.DepartmentId IS NOT NULL AND ISNULL(j.TerminalLevel, 0) = 0;

    -- Members follow their group's pairs and kind; team always follows the line.
    UPDATE e SET ProductionLineId = p.ProductionLineId, ShiftTeamId = p.ShiftTeamId,
        CongDoan = CASE WHEN e.ProductionLineId = p.ProductionLineId THEN ISNULL(e.CongDoan, l.CongDoan) ELSE l.CongDoan END,
        TaskName = ISNULL(e.TaskName, CASE WHEN l.CongDoan = N'GT A' THEN N'Office' END)
    FROM Employees e
    CROSS APPLY (SELECT TOP 1 gl.ProductionLineId, gl.ShiftTeamId FROM GroupLines gl WHERE gl.GroupId = e.GroupId ORDER BY gl.Id) p
    JOIN ProductionLines l ON l.Id = p.ProductionLineId
    WHERE e.IsDeleted = 0 AND NOT EXISTS (SELECT 1 FROM GroupLines c WHERE c.GroupId = e.GroupId AND c.ProductionLineId = e.ProductionLineId AND c.ShiftTeamId = e.ShiftTeamId);
    UPDATE e SET StaffKind = g.LineKind FROM Employees e JOIN Groups g ON g.Id = e.GroupId JOIN ProductionLines l ON l.Id = e.ProductionLineId
    WHERE e.IsDeleted = 0 AND ISNULL(e.StaffKind, N'') <> g.LineKind
        AND ((g.LineKind = N'TT' AND l.HasDirectStaff = 1) OR (g.LineKind = N'GT' AND l.HasIndirectStaff = 1));
    UPDATE e SET TeamId = l.TeamId FROM Employees e JOIN ProductionLines l ON l.Id = e.ProductionLineId WHERE ISNULL(e.TeamId, 0) <> ISNULL(l.TeamId, 0);

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113072406_LineStructureFixes'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261113072406_LineStructureFixes', N'10.0.9');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113072917_KhoCotLine'
)
BEGIN

    DECLARE @g TABLE (GroupId int, WorkshopId int, SourceLineId int);
    INSERT @g SELECT g.Id, g.WorkshopId, l.Id FROM Groups g JOIN GroupLines gl ON gl.GroupId = g.Id JOIN ProductionLines l ON l.Id = gl.ProductionLineId
    WHERE g.IsDeleted = 0 AND l.LineCode = N'KHO' AND g.GroupNameVn LIKE N'%Kho COT%';
    INSERT ProductionLines (LineCode, TeamId, CongDoan, IsDeleted, WorkshopId, CdMae, SortCode, HasDirectStaff, HasIndirectStaff)
    SELECT DISTINCT N'KHO-COT', s.TeamId, s.CongDoan, 0, x.WorkshopId, s.CdMae, N'KHO-COT', s.HasDirectStaff, s.HasIndirectStaff
    FROM @g x JOIN ProductionLines s ON s.Id = x.SourceLineId
    WHERE NOT EXISTS (SELECT 1 FROM ProductionLines l WHERE l.WorkshopId = x.WorkshopId AND l.LineCode = N'KHO-COT' AND l.IsDeleted = 0);
    UPDATE gl SET ProductionLineId = l.Id FROM GroupLines gl JOIN @g x ON x.GroupId = gl.GroupId AND gl.ProductionLineId = x.SourceLineId
    JOIN ProductionLines l ON l.WorkshopId = x.WorkshopId AND l.LineCode = N'KHO-COT' AND l.IsDeleted = 0;
    UPDATE e SET ProductionLineId = gl.ProductionLineId, TeamId = l.TeamId, CongDoan = l.CongDoan
    FROM Employees e JOIN @g x ON x.GroupId = e.GroupId JOIN GroupLines gl ON gl.GroupId = e.GroupId AND gl.ShiftTeamId = e.ShiftTeamId
    JOIN ProductionLines l ON l.Id = gl.ProductionLineId
    WHERE e.IsDeleted = 0 AND e.ProductionLineId = x.SourceLineId;

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113072917_KhoCotLine'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261113072917_KhoCotLine', N'10.0.9');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113082211_EmployeeResigned'
)
BEGIN
    ALTER TABLE [Employees] ADD [ResignedAt] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113082211_EmployeeResigned'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261113082211_EmployeeResigned', N'10.0.9');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113082925_GroupStepwiseEdit'
)
BEGIN
    ALTER TABLE [Groups] ADD [StepwiseEdit] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113082925_GroupStepwiseEdit'
)
BEGIN
    UPDATE g SET StepwiseEdit = 1 FROM Groups g JOIN Departments d ON d.Id = g.DepartmentId WHERE d.DepartmentCode = N'PRO'
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113082925_GroupStepwiseEdit'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261113082925_GroupStepwiseEdit', N'10.0.9');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113084530_RemoveProductionApprovalTree'
)
BEGIN

    -- Each department's production chain becomes the intermediate levels of every group of it that has no tree yet,
    -- with the same people the chain resolved to: the line's Line Leaders, and Group/Team Leaders of the same department and workshop.
    DECLARE @lvl TABLE (GroupId int, JobTitleId int, StepOrder int, RequiresSignature bit, IsResponsible bit, IsLineScoped bit, DepartmentId int, WorkshopId int);
    INSERT @lvl
    SELECT g.Id, p.JobTitleId, p.StepOrder, p.RequiresSignature, p.IsResponsible, j.IsLineScoped, g.DepartmentId, g.WorkshopId
    FROM ProductionApprovalSteps p
    JOIN JobTitles j ON j.Id = p.JobTitleId
    JOIN Groups g ON g.DepartmentId = p.DepartmentId AND g.IsDeleted = 0
    WHERE p.IsDeleted = 0 AND j.TerminalLevel = 0
        AND NOT EXISTS (SELECT 1 FROM GroupApprovalSteps s WHERE s.GroupId = g.Id AND s.IsDeleted = 0);

    DECLARE @mem TABLE (GroupId int, JobTitleId int, EmployeeId int);
    INSERT @mem
    SELECT DISTINCT l.GroupId, l.JobTitleId, e.Id
    FROM @lvl l
    JOIN Employees e ON e.IsDeleted = 0 AND e.UserName IS NOT NULL AND e.JobTitleId = l.JobTitleId
    JOIN Groups eg ON eg.Id = e.GroupId AND eg.DepartmentId = l.DepartmentId
    WHERE (l.IsLineScoped = 1 AND EXISTS (SELECT 1 FROM GroupLines gl WHERE gl.GroupId = l.GroupId AND gl.ProductionLineId = e.ProductionLineId))
        OR (l.IsLineScoped = 0 AND eg.WorkshopId = l.WorkshopId);

    INSERT GroupApprovalSteps (GroupId, StepOrder, JobTitleId, RequiresSignature, IsResponsible, CanResubmit, ResubmitSkipsIntermediate, IsDeleted)
    SELECT l.GroupId, ROW_NUMBER() OVER (PARTITION BY l.GroupId ORDER BY l.StepOrder), l.JobTitleId, l.RequiresSignature, l.IsResponsible, 0, 0, 0
    FROM @lvl l
    WHERE EXISTS (SELECT 1 FROM @mem m WHERE m.GroupId = l.GroupId AND m.JobTitleId = l.JobTitleId);

    INSERT GroupApprovalStepMembers (GroupApprovalStepId, EmployeeId, ReceivesMail)
    SELECT s.Id, m.EmployeeId, 1
    FROM @mem m JOIN GroupApprovalSteps s ON s.GroupId = m.GroupId AND s.JobTitleId = m.JobTitleId AND s.IsDeleted = 0;

    -- One way to create forms: whoever could create production forms by job title now creates group forms.
    UPDATE c SET IsDeleted = 0
    FROM JobTitlePermissions c
    WHERE c.PermissionCode = N'Attendance.OTForm.Create' AND c.IsDeleted = 1
        AND EXISTS (SELECT 1 FROM JobTitlePermissions p WHERE p.JobTitleId = c.JobTitleId AND p.PermissionCode = N'Attendance.OTForm.CreateProduction' AND p.IsDeleted = 0)
        AND NOT EXISTS (SELECT 1 FROM JobTitlePermissions x WHERE x.JobTitleId = c.JobTitleId AND x.PermissionCode = N'Attendance.OTForm.Create' AND x.IsDeleted = 0);
    INSERT JobTitlePermissions (JobTitleId, PermissionCode, IsDeleted)
    SELECT DISTINCT p.JobTitleId, N'Attendance.OTForm.Create', 0
    FROM JobTitlePermissions p
    WHERE p.PermissionCode = N'Attendance.OTForm.CreateProduction' AND p.IsDeleted = 0
        AND NOT EXISTS (SELECT 1 FROM JobTitlePermissions x WHERE x.JobTitleId = p.JobTitleId AND x.PermissionCode = N'Attendance.OTForm.Create');
    UPDATE JobTitlePermissions SET IsDeleted = 1 WHERE PermissionCode = N'Attendance.OTForm.CreateProduction' AND IsDeleted = 0;

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113084530_RemoveProductionApprovalTree'
)
BEGIN
    DROP TABLE [ProductionApprovalSteps];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113084530_RemoveProductionApprovalTree'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261113084530_RemoveProductionApprovalTree', N'10.0.9');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261116022631_ProductionTaskCatalog'
)
BEGIN
    CREATE TABLE [ProductionTasks] (
        [Id] int NOT NULL IDENTITY,
        [WorkshopId] int NOT NULL,
        [Code] nvarchar(50) NOT NULL,
        [StaffKind] nvarchar(2) NOT NULL,
        [IsDeleted] bit NOT NULL,
        CONSTRAINT [PK_ProductionTasks] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ProductionTasks_Workshops_WorkshopId] FOREIGN KEY ([WorkshopId]) REFERENCES [Workshops] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261116022631_ProductionTaskCatalog'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_ProductionTasks_WorkshopId_Code] ON [ProductionTasks] ([WorkshopId], [Code]) WHERE [IsDeleted] = 0');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261116022631_ProductionTaskCatalog'
)
BEGIN

    INSERT INTO ProductionTasks (WorkshopId, Code, StaffKind, IsDeleted)
    SELECT g.WorkshopId, MIN(LEFT(LTRIM(RTRIM(e.TaskName)), 50)),
           CASE WHEN UPPER(LEFT(LTRIM(RTRIM(e.TaskName)), 50)) = 'OFFICE'
                     OR SUM(CASE WHEN e.StaffKind = 'GT' THEN 1 ELSE 0 END) >= SUM(CASE WHEN e.StaffKind = 'TT' THEN 1 ELSE 0 END)
                THEN 'GT' ELSE 'TT' END,
           0
    FROM Employees e
    JOIN Groups g ON g.Id = e.GroupId
    WHERE e.IsDeleted = 0 AND e.TaskName IS NOT NULL AND LTRIM(RTRIM(e.TaskName)) <> ''
    GROUP BY g.WorkshopId, UPPER(LEFT(LTRIM(RTRIM(e.TaskName)), 50));

    INSERT INTO ProductionTasks (WorkshopId, Code, StaffKind, IsDeleted)
    SELECT w.Id, 'Office', 'GT', 0
    FROM Workshops w
    WHERE w.IsDeleted = 0
      AND NOT EXISTS (SELECT 1 FROM ProductionTasks t WHERE t.WorkshopId = w.Id AND t.Code = 'Office' AND t.IsDeleted = 0);

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261116022631_ProductionTaskCatalog'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261116022631_ProductionTaskCatalog', N'10.0.9');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261116025720_GroupsWithoutStaffKind'
)
BEGIN

    WITH p AS (
        SELECT gl.Id AS GlId, g.Id AS GroupId, g.WorkshopId, g.DepartmentId, gl.ProductionLineId, gl.ShiftTeamId,
               ROW_NUMBER() OVER (PARTITION BY g.WorkshopId, g.DepartmentId, gl.ProductionLineId, gl.ShiftTeamId
                                  ORDER BY CASE WHEN g.LineKind = 'TT' THEN 0 ELSE 1 END, g.Id) AS Rn
        FROM GroupLines gl JOIN Groups g ON g.Id = gl.GroupId
        WHERE g.IsDeleted = 0)
    SELECT d.GlId, d.GroupId AS FromGroupId, k.GroupId AS ToGroupId, d.ProductionLineId, d.ShiftTeamId
    INTO #Moves
    FROM p d JOIN p k ON k.Rn = 1 AND k.WorkshopId = d.WorkshopId AND k.DepartmentId = d.DepartmentId
        AND k.ProductionLineId = d.ProductionLineId AND k.ShiftTeamId = d.ShiftTeamId
    WHERE d.Rn > 1;

    SELECT DISTINCT m.FromGroupId INTO #Emptied FROM #Moves m
    WHERE NOT EXISTS (SELECT 1 FROM GroupLines gl WHERE gl.GroupId = m.FromGroupId AND gl.Id NOT IN (SELECT GlId FROM #Moves));

    UPDATE e SET GroupId = m.ToGroupId
    FROM Employees e JOIN #Moves m ON m.FromGroupId = e.GroupId
    WHERE e.IsDeleted = 0
      AND ((e.ProductionLineId = m.ProductionLineId AND e.ShiftTeamId = m.ShiftTeamId) OR e.GroupId IN (SELECT FromGroupId FROM #Emptied));

    DELETE gl FROM GroupLines gl JOIN #Moves m ON m.GlId = gl.Id;
    UPDATE Groups SET IsDeleted = 1 WHERE Id IN (SELECT FromGroupId FROM #Emptied);
    DROP TABLE #Moves;
    DROP TABLE #Emptied;

    UPDATE Groups SET GroupNameVn = RTRIM(LEFT(RTRIM(GroupNameVn), LEN(GroupNameVn) - 3))
    WHERE IsDeleted = 0 AND (RTRIM(GroupNameVn) LIKE '% TT' OR RTRIM(GroupNameVn) LIKE '% GT');

    UPDATE e SET StaffKind = t.StaffKind
    FROM Employees e
    JOIN Groups g ON g.Id = e.GroupId
    JOIN ProductionTasks t ON t.WorkshopId = g.WorkshopId AND t.Code = e.TaskName AND t.IsDeleted = 0
    WHERE e.IsDeleted = 0;

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261116025720_GroupsWithoutStaffKind'
)
BEGIN
    DROP INDEX [IX_Groups_GroupCode] ON [Groups];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261116025720_GroupsWithoutStaffKind'
)
BEGIN
    DECLARE @var5 nvarchar(max);
    SELECT @var5 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ProductionLines]') AND [c].[name] = N'HasDirectStaff');
    IF @var5 IS NOT NULL EXEC(N'ALTER TABLE [ProductionLines] DROP CONSTRAINT ' + @var5 + ';');
    ALTER TABLE [ProductionLines] DROP COLUMN [HasDirectStaff];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261116025720_GroupsWithoutStaffKind'
)
BEGIN
    DECLARE @var6 nvarchar(max);
    SELECT @var6 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ProductionLines]') AND [c].[name] = N'HasIndirectStaff');
    IF @var6 IS NOT NULL EXEC(N'ALTER TABLE [ProductionLines] DROP CONSTRAINT ' + @var6 + ';');
    ALTER TABLE [ProductionLines] DROP COLUMN [HasIndirectStaff];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261116025720_GroupsWithoutStaffKind'
)
BEGIN
    DECLARE @var7 nvarchar(max);
    SELECT @var7 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Groups]') AND [c].[name] = N'LineKind');
    IF @var7 IS NOT NULL EXEC(N'ALTER TABLE [Groups] DROP CONSTRAINT ' + @var7 + ';');
    ALTER TABLE [Groups] DROP COLUMN [LineKind];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261116025720_GroupsWithoutStaffKind'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_Groups_GroupCode] ON [Groups] ([GroupCode]) WHERE [IsDeleted] = 0');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261116025720_GroupsWithoutStaffKind'
)
BEGIN

    WITH c AS (
        SELECT g.Id, LEFT(d.DepartmentCode + '-' + l.LineCode + '-' + st.Code, 50) AS Base, w.WorkshopCode
        FROM Groups g
        JOIN Departments d ON d.Id = g.DepartmentId
        JOIN Workshops w ON w.Id = g.WorkshopId
        CROSS APPLY (SELECT TOP 1 gl.ProductionLineId, gl.ShiftTeamId FROM GroupLines gl WHERE gl.GroupId = g.Id ORDER BY gl.Id) f
        JOIN ProductionLines l ON l.Id = f.ProductionLineId
        JOIN ProductionShiftTeams st ON st.Id = f.ShiftTeamId
        WHERE g.IsDeleted = 0),
    r AS (SELECT c.*, ROW_NUMBER() OVER (PARTITION BY Base ORDER BY Id) AS Rn FROM c)
    UPDATE g SET GroupCode = CASE WHEN r.Rn = 1 THEN r.Base ELSE LEFT(r.Base + '-' + r.WorkshopCode, 50) END
    FROM Groups g JOIN r ON r.Id = g.Id;

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261116025720_GroupsWithoutStaffKind'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261116025720_GroupsWithoutStaffKind', N'10.0.9');
END;

COMMIT;
GO


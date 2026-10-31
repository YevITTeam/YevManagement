/*
    Go-live cleanup for YevOTManagement_Production: removes every OT form (with steps, candidates, histories,
    email tokens, edit logs, process parts), every batch ("Don tong") and the whole accumulation ledger, imported
    opening balances (Month = 0) included, so every employee starts at 0h.

    KEPT: master data, approval trees, signatures, secondary passwords, delegations, settings, calendar.

    How to run (SSMS or sqlcmd, on DASVRFAST):
      1. Stop the HostApi site in IIS so no form is created or approved mid-cleanup.
      2. Run as-is: @DryRun = 1 deletes inside a transaction, prints the counts, then rolls back.
      3. Set @DryRun = 0 and run again: takes a COPY_ONLY backup, deletes, commits, reseeds ids to start at 1.
      4. Start the site again.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
USE [YevOTManagement_Production];
GO

DECLARE @DryRun bit = 1;  -- 1 = rehearsal (rollback), 0 = really delete
DECLARE @BackupFile nvarchar(400) =
    N'D:\SQL Data\Microsoft SQL Server\MSSQL15.MSSQLSERVER\MSSQL\Backup\YevOTManagement_Production_before_golive_'
    + CONVERT(nvarchar(8), GETDATE(), 112) + N'.bak';

IF DB_NAME() <> N'YevOTManagement_Production'
BEGIN
    RAISERROR(N'Wrong database, expected YevOTManagement_Production.', 16, 1);
    RETURN;
END

DECLARE @Counts TABLE (Step nvarchar(10), TableName sysname, Rows int);
INSERT @Counts SELECT N'before', N'OtForms', COUNT(*) FROM dbo.OtForms
UNION ALL SELECT N'before', N'OtFormEmployees', COUNT(*) FROM dbo.OtFormEmployees
UNION ALL SELECT N'before', N'OtFormApprovalSteps', COUNT(*) FROM dbo.OtFormApprovalSteps
UNION ALL SELECT N'before', N'OtFormApprovalStepCandidates', COUNT(*) FROM dbo.OtFormApprovalStepCandidates
UNION ALL SELECT N'before', N'OtFormApprovalHistories', COUNT(*) FROM dbo.OtFormApprovalHistories
UNION ALL SELECT N'before', N'OtFormApprovalEmailTokens', COUNT(*) FROM dbo.OtFormApprovalEmailTokens
UNION ALL SELECT N'before', N'OtFormEditLogs', COUNT(*) FROM dbo.OtFormEditLogs
UNION ALL SELECT N'before', N'ProcessParts', COUNT(*) FROM dbo.ProcessParts
UNION ALL SELECT N'before', N'OtFormBatches', COUNT(*) FROM dbo.OtFormBatches
UNION ALL SELECT N'before', N'OtFormBatchEmailTokens', COUNT(*) FROM dbo.OtFormBatchEmailTokens
UNION ALL SELECT N'before', N'EmployeeAccumulationHistories', COUNT(*) FROM dbo.EmployeeAccumulationHistories;

IF @DryRun = 0
BEGIN
    BACKUP DATABASE [YevOTManagement_Production] TO DISK = @BackupFile WITH COPY_ONLY, INIT, CHECKSUM;
    PRINT N'Backup written: ' + @BackupFile;
END

BEGIN TRY
    BEGIN TRANSACTION;

    -- Children first: histories and email tokens reference steps with NO ACTION.
    DELETE FROM dbo.OtFormApprovalEmailTokens;
    DELETE FROM dbo.OtFormApprovalHistories;
    DELETE FROM dbo.OtFormApprovalStepCandidates;
    DELETE FROM dbo.OtFormApprovalSteps;
    DELETE FROM dbo.OtFormEditLogs;
    DELETE FROM dbo.OtFormEmployees;
    DELETE FROM dbo.ProcessParts;
    DELETE FROM dbo.OtForms;
    DELETE FROM dbo.OtFormBatchEmailTokens;
    DELETE FROM dbo.OtFormBatches;

    DELETE FROM dbo.EmployeeAccumulationHistories;

    INSERT @Counts SELECT N'after', N'OtForms', COUNT(*) FROM dbo.OtForms
    UNION ALL SELECT N'after', N'OtFormBatches', COUNT(*) FROM dbo.OtFormBatches
    UNION ALL SELECT N'after', N'EmployeeAccumulationHistories', COUNT(*) FROM dbo.EmployeeAccumulationHistories;

    IF @DryRun = 1
    BEGIN
        ROLLBACK TRANSACTION;
        PRINT N'DRY RUN: everything rolled back. Set @DryRun = 0 to apply.';
    END
    ELSE
    BEGIN
        COMMIT TRANSACTION;
        PRINT N'Committed.';
    END
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH

SELECT Step, TableName, Rows FROM @Counts ORDER BY CASE Step WHEN N'before' THEN 0 ELSE 1 END, TableName;

-- Identity reseed is not transactional, so it only runs after a real commit; next id becomes 1.
IF @DryRun = 0
BEGIN
    DECLARE @t sysname, @sql nvarchar(400);
    DECLARE reseed CURSOR LOCAL FAST_FORWARD FOR
        SELECT name FROM sys.tables
        WHERE name IN (N'OtForms', N'OtFormApprovalSteps', N'OtFormApprovalStepCandidates', N'OtFormApprovalHistories',
                       N'OtFormApprovalEmailTokens', N'OtFormEditLogs', N'ProcessParts', N'OtFormBatches',
                       N'OtFormBatchEmailTokens', N'EmployeeAccumulationHistories')
          AND OBJECTPROPERTY(object_id, 'TableHasIdentity') = 1;
    OPEN reseed;
    FETCH NEXT FROM reseed INTO @t;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'DBCC CHECKIDENT (''dbo.' + @t + N''', RESEED, 0) WITH NO_INFOMSGS;';
        EXEC (@sql);
        FETCH NEXT FROM reseed INTO @t;
    END
    CLOSE reseed;
    DEALLOCATE reseed;
    PRINT N'Identities reseeded.';
END
GO

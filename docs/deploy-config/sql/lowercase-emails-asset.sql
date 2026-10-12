-- Asset DB: lowercases DeviceEmails.Email. Runs as a dry run (rolled back) until @DryRun is set to 0.
USE [YevPCManagement_Production];
GO
SET XACT_ABORT ON;
DECLARE @DryRun bit = 0;

BEGIN TRAN;

SELECT COUNT(*) AS RowsToLowercase
FROM dbo.DeviceEmails
WHERE Email COLLATE Latin1_General_CS_AS <> LOWER(Email) COLLATE Latin1_General_CS_AS;

-- Active duplicates on one device that differ only by case: keep the lowest Id, soft-delete the rest.
;WITH ranked AS (
    SELECT Id, ROW_NUMBER() OVER (PARTITION BY DeviceId, LOWER(Email) ORDER BY Id) AS rn
    FROM dbo.DeviceEmails
    WHERE IsDeleted = 0
)
UPDATE e SET IsDeleted = 1
FROM dbo.DeviceEmails e
JOIN ranked r ON r.Id = e.Id
WHERE r.rn > 1;
SELECT @@ROWCOUNT AS DuplicatesSoftDeleted;

UPDATE dbo.DeviceEmails
SET Email = LOWER(Email)
WHERE Email COLLATE Latin1_General_CS_AS <> LOWER(Email) COLLATE Latin1_General_CS_AS;
SELECT @@ROWCOUNT AS RowsLowercased;

IF @DryRun = 1 BEGIN ROLLBACK; PRINT 'Dry run: rolled back. Set @DryRun = 0 to apply.'; END
ELSE BEGIN COMMIT; PRINT 'Committed.'; END
GO

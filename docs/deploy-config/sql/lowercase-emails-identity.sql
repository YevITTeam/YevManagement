-- Identity DB: lowercases UserEmails.Email and Users.Email. Runs as a dry run (rolled back) until @DryRun is set to 0.
-- Safe against the unique (UserId, Email) index: the column collation is case-insensitive, so no two rows differ only by case.
USE [YevIdentityManagement];
GO
SET XACT_ABORT ON;
DECLARE @DryRun bit = 1;

BEGIN TRAN;

SELECT
    (SELECT COUNT(*) FROM dbo.UserEmails WHERE Email COLLATE Latin1_General_CS_AS <> LOWER(Email) COLLATE Latin1_General_CS_AS) AS UserEmailsToLowercase,
    (SELECT COUNT(*) FROM dbo.Users WHERE Email COLLATE Latin1_General_CS_AS <> LOWER(Email) COLLATE Latin1_General_CS_AS) AS UsersToLowercase;

UPDATE dbo.UserEmails
SET Email = LOWER(Email)
WHERE Email COLLATE Latin1_General_CS_AS <> LOWER(Email) COLLATE Latin1_General_CS_AS;
SELECT @@ROWCOUNT AS UserEmailsLowercased;

UPDATE dbo.Users
SET Email = LOWER(Email)
WHERE Email COLLATE Latin1_General_CS_AS <> LOWER(Email) COLLATE Latin1_General_CS_AS;
SELECT @@ROWCOUNT AS UsersLowercased;

IF @DryRun = 1 BEGIN ROLLBACK; PRINT 'Dry run: rolled back. Set @DryRun = 0 to apply.'; END
ELSE BEGIN COMMIT; PRINT 'Committed.'; END
GO

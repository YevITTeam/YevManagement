BEGIN TRANSACTION;
ALTER TABLE [OtFormApprovalHistories] ADD [OnBehalfOfFullName] nvarchar(255) NULL;

ALTER TABLE [OtFormApprovalHistories] ADD [OnBehalfOfUserName] nvarchar(100) NULL;

CREATE TABLE [ApprovalDelegations] (
    [Id] int NOT NULL IDENTITY,
    [DelegatorEmployeeId] int NOT NULL,
    [DelegateEmployeeId] int NOT NULL,
    [FromDate] date NOT NULL,
    [ToDate] date NOT NULL,
    [Reason] nvarchar(500) NULL,
    [IsDeleted] bit NOT NULL,
    CONSTRAINT [PK_ApprovalDelegations] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_ApprovalDelegations_Employees_DelegateEmployeeId] FOREIGN KEY ([DelegateEmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_ApprovalDelegations_Employees_DelegatorEmployeeId] FOREIGN KEY ([DelegatorEmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION
);

CREATE INDEX [IX_ApprovalDelegations_DelegateEmployeeId_FromDate_ToDate] ON [ApprovalDelegations] ([DelegateEmployeeId], [FromDate], [ToDate]);

CREATE INDEX [IX_ApprovalDelegations_DelegatorEmployeeId] ON [ApprovalDelegations] ([DelegatorEmployeeId]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20261008020236_AddApprovalDelegations', N'10.0.9');

COMMIT;
GO


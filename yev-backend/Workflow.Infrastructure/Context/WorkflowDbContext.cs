using Microsoft.EntityFrameworkCore;
using Workflow.Domain.Entities;

namespace Workflow.Infrastructure.Context;

// DB: YevWorkflowManagement — hoàn toàn mới, KHÔNG scaffold từ hệ cũ, nên dùng tên constraint tiếng
// Anh chuẩn EF Core (workflow-module.md §5.10), khác quy ước tên tiếng Việt của Asset/Attendance.
public partial class WorkflowDbContext : DbContext
{
    public WorkflowDbContext()
    {
    }

    public WorkflowDbContext(DbContextOptions<WorkflowDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<OrgLevel> OrgLevels { get; set; }
    public virtual DbSet<OrgUnit> OrgUnits { get; set; }
    public virtual DbSet<JobTitle> JobTitles { get; set; }
    public virtual DbSet<Employee> Employees { get; set; }
    public virtual DbSet<EmployeeOrgUnit> EmployeeOrgUnits { get; set; }
    public virtual DbSet<FormCategory> FormCategories { get; set; }
    public virtual DbSet<FormCategoryCoordinator> FormCategoryCoordinators { get; set; }
    public virtual DbSet<FormDataSource> FormDataSources { get; set; }
    public virtual DbSet<FormDefinition> FormDefinitions { get; set; }
    public virtual DbSet<FormField> FormFields { get; set; }
    public virtual DbSet<FormFieldCondition> FormFieldConditions { get; set; }
    public virtual DbSet<FormAccess> FormAccesses { get; set; }
    public virtual DbSet<FormRoute> FormRoutes { get; set; }
    public virtual DbSet<FormApprovalStep> FormApprovalSteps { get; set; }
    public virtual DbSet<FormApprovalStepParticipant> FormApprovalStepParticipants { get; set; }
    public virtual DbSet<WorkflowRequest> WorkflowRequests { get; set; }
    public virtual DbSet<WorkflowRequestStep> WorkflowRequestSteps { get; set; }
    public virtual DbSet<WorkflowRequestStepParticipant> WorkflowRequestStepParticipants { get; set; }
    public virtual DbSet<WorkflowRequestHistory> WorkflowRequestHistories { get; set; }
    public virtual DbSet<WorkflowSequence> WorkflowSequences { get; set; }
    public virtual DbSet<ApprovalDelegation> ApprovalDelegations { get; set; }
    public virtual DbSet<EmployeeSignature> EmployeeSignatures { get; set; }
    public virtual DbSet<PendingEmployeeSignatureConfirmation> PendingEmployeeSignatureConfirmations { get; set; }
    public virtual DbSet<WorkflowAttachment> WorkflowAttachments { get; set; }
    public virtual DbSet<WorkflowSetting> WorkflowSettings { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<OrgLevel>(entity =>
        {
            entity.HasIndex(e => e.LevelNumber, "IX_OrgLevels_LevelNumber").IsUnique();
            entity.Property(e => e.NameVn).HasMaxLength(100);
            entity.Property(e => e.NameJp).HasMaxLength(100);
        });

        modelBuilder.Entity<OrgUnit>(entity =>
        {
            entity.HasIndex(e => e.Code, "IX_OrgUnits_Code").IsUnique();
            entity.HasIndex(e => e.ParentId, "IX_OrgUnits_ParentId");

            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.NameVn).HasMaxLength(200);
            entity.Property(e => e.NameJp).HasMaxLength(200);

            entity.HasOne(d => d.OrgLevel).WithMany(p => p.OrgUnits)
                .HasForeignKey(d => d.OrgLevelId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OrgUnits_OrgLevels_OrgLevelId");

            entity.HasOne(d => d.Parent).WithMany(p => p.Children)
                .HasForeignKey(d => d.ParentId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OrgUnits_OrgUnits_ParentId");
        });

        modelBuilder.Entity<JobTitle>(entity =>
        {
            entity.HasIndex(e => e.Code, "IX_JobTitles_Code").IsUnique();
            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.NameVn).HasMaxLength(200);
            entity.Property(e => e.NameJp).HasMaxLength(200);
        });

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.HasIndex(e => e.EmployeeCode, "IX_Employees_EmployeeCode").IsUnique();
            // Cross-DB pointer sang Identity.Users.Id — KHÔNG FK thật (workflow-module.md §1.4).
            entity.HasIndex(e => e.UserId, "IX_Employees_UserId").IsUnique().HasFilter("[UserId] IS NOT NULL");

            entity.Property(e => e.EmployeeCode).HasMaxLength(50);
            entity.Property(e => e.FullName).HasMaxLength(200);
            entity.Property(e => e.FullNameJp).HasMaxLength(200);
            entity.Property(e => e.Email).HasMaxLength(200);
            entity.Property(e => e.Position).HasMaxLength(100);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
        });

        modelBuilder.Entity<EmployeeOrgUnit>(entity =>
        {
            // .HasFilter(null) ép EF Core bỏ filter "WHERE JobTitleId IS NOT NULL" mà nó tự thêm theo
            // convention mặc định — giữ đúng hành vi gốc của SQL Server (coi NULL = NULL khi so composite
            // unique index, workflow-module.md §3.2 FormAccesses) để 1 Employee không bị gán trùng vào
            // cùng 1 OrgUnit khi JobTitleId đều NULL.
            entity.HasIndex(e => new { e.EmployeeId, e.OrgUnitId, e.JobTitleId }, "IX_EmployeeOrgUnits_EmployeeId_OrgUnitId_JobTitleId").IsUnique().HasFilter(null);
            // Resolve người duyệt theo chức danh tại 1 node (workflow-module.md §5.9) — chạy cho mọi
            // bước, mọi lần nộp đơn, nên cần index riêng ngoài UNIQUE ở trên.
            entity.HasIndex(e => new { e.OrgUnitId, e.JobTitleId }, "IX_EmployeeOrgUnits_OrgUnitId_JobTitleId");
            entity.HasIndex(e => e.EmployeeId, "IX_EmployeeOrgUnits_EmployeeId");

            entity.HasOne(d => d.Employee).WithMany(p => p.EmployeeOrgUnits)
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_EmployeeOrgUnits_Employees_EmployeeId");

            entity.HasOne(d => d.OrgUnit).WithMany(p => p.EmployeeOrgUnits)
                .HasForeignKey(d => d.OrgUnitId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_EmployeeOrgUnits_OrgUnits_OrgUnitId");

            entity.HasOne(d => d.JobTitle).WithMany(p => p.EmployeeOrgUnits)
                .HasForeignKey(d => d.JobTitleId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_EmployeeOrgUnits_JobTitles_JobTitleId");
        });

        modelBuilder.Entity<FormCategory>(entity =>
        {
            entity.HasIndex(e => e.Code, "IX_FormCategories_Code").IsUnique();

            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.NameVn).HasMaxLength(200);
            entity.Property(e => e.NameJp).HasMaxLength(200);

            entity.HasOne(d => d.OrgUnit).WithMany(p => p.FormCategories)
                .HasForeignKey(d => d.OrgUnitId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_FormCategories_OrgUnits_OrgUnitId");
        });

        modelBuilder.Entity<FormCategoryCoordinator>(entity =>
        {
            entity.HasIndex(e => new { e.FormCategoryId, e.EmployeeId }, "IX_FormCategoryCoordinators_FormCategoryId_EmployeeId").IsUnique();

            entity.HasOne(d => d.FormCategory).WithMany(p => p.FormCategoryCoordinators)
                .HasForeignKey(d => d.FormCategoryId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_FormCategoryCoordinators_FormCategories_FormCategoryId");

            entity.HasOne(d => d.Employee).WithMany(p => p.FormCategoryCoordinators)
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_FormCategoryCoordinators_Employees_EmployeeId");
        });

        modelBuilder.Entity<FormDataSource>(entity =>
        {
            entity.HasIndex(e => e.Code, "IX_FormDataSources_Code").IsUnique();

            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.NameVn).HasMaxLength(200);
            entity.Property(e => e.NameJp).HasMaxLength(200);
            entity.Property(e => e.ConnectionName).HasMaxLength(100);
            entity.Property(e => e.ValueColumn).HasMaxLength(100);
            entity.Property(e => e.DisplayColumn).HasMaxLength(100);
        });

        modelBuilder.Entity<FormDefinition>(entity =>
        {
            entity.HasIndex(e => e.Code, "IX_FormDefinitions_Code").IsUnique();
            entity.HasIndex(e => e.FormCategoryId, "IX_FormDefinitions_FormCategoryId");

            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.NameVn).HasMaxLength(200);
            entity.Property(e => e.NameJp).HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.CodePrefix).HasMaxLength(20);
            entity.Property(e => e.RouteNumericFieldKey).HasMaxLength(50);
            entity.Property(e => e.RouteClassFieldKey).HasMaxLength(50);
            entity.Property(e => e.Version).HasDefaultValue(1);

            entity.HasOne(d => d.FormCategory).WithMany(p => p.FormDefinitions)
                .HasForeignKey(d => d.FormCategoryId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_FormDefinitions_FormCategories_FormCategoryId");

            entity.HasOne(d => d.CreatedByEmployee).WithMany(p => p.CreatedFormDefinitions)
                .HasForeignKey(d => d.CreatedByEmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_FormDefinitions_Employees_CreatedByEmployeeId");

            entity.HasOne(d => d.UpdatedByEmployee).WithMany(p => p.UpdatedFormDefinitions)
                .HasForeignKey(d => d.UpdatedByEmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_FormDefinitions_Employees_UpdatedByEmployeeId");
        });

        modelBuilder.Entity<FormField>(entity =>
        {
            entity.HasIndex(e => new { e.FormDefinitionId, e.FieldKey }, "IX_FormFields_FormDefinitionId_FieldKey").IsUnique();
            entity.HasIndex(e => new { e.FormDefinitionId, e.SortOrder }, "IX_FormFields_FormDefinitionId_SortOrder");

            entity.Property(e => e.FieldKey).HasMaxLength(50);
            entity.Property(e => e.LabelVn).HasMaxLength(200);
            entity.Property(e => e.LabelJp).HasMaxLength(200);
            entity.Property(e => e.Placeholder).HasMaxLength(200);
            entity.Property(e => e.DefaultValue).HasMaxLength(500);
            entity.Property(e => e.HelpTextVn).HasMaxLength(500);
            entity.Property(e => e.AutoNumberPattern).HasMaxLength(100);
            entity.Property(e => e.MinValue).HasColumnType("decimal(18,4)");
            entity.Property(e => e.MaxValue).HasColumnType("decimal(18,4)");
            entity.Property(e => e.ColumnSpan).HasDefaultValue(1);
            entity.Property(e => e.DefaultVisible).HasDefaultValue(true);

            entity.HasOne(d => d.FormDefinition).WithMany(p => p.FormFields)
                .HasForeignKey(d => d.FormDefinitionId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_FormFields_FormDefinitions_FormDefinitionId");

            entity.HasOne(d => d.FormDataSource).WithMany(p => p.FormFields)
                .HasForeignKey(d => d.FormDataSourceId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_FormFields_FormDataSources_FormDataSourceId");
        });

        modelBuilder.Entity<FormFieldCondition>(entity =>
        {
            entity.HasIndex(e => e.TargetFieldId, "IX_FormFieldConditions_TargetFieldId");
            entity.HasIndex(e => e.SourceFieldId, "IX_FormFieldConditions_SourceFieldId");

            entity.Property(e => e.CompareValue).HasMaxLength(500);
            entity.Property(e => e.CompareValue2).HasMaxLength(500);
            entity.Property(e => e.LogicGroup).HasDefaultValue(1);

            // TargetFieldId Cascade / SourceFieldId Restrict (workflow-module.md §3.2) — 2 FK cùng
            // trỏ FormFields nên EF không tự suy được, phải khai rõ cả navigation lẫn OnDelete.
            entity.HasOne(d => d.TargetField).WithMany(p => p.TargetOfConditions)
                .HasForeignKey(d => d.TargetFieldId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_FormFieldConditions_FormFields_TargetFieldId");

            entity.HasOne(d => d.SourceField).WithMany(p => p.SourceOfConditions)
                .HasForeignKey(d => d.SourceFieldId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_FormFieldConditions_FormFields_SourceFieldId");
        });

        modelBuilder.Entity<FormAccess>(entity =>
        {
            // .HasFilter(null) giữ đúng hành vi SQL Server "NULL = NULL" khi so composite unique index
            // (cùng lý do với EmployeeOrgUnits ở trên) — mỗi dòng chỉ có đúng 1 trong 3 cột đích khác
            // NULL theo TargetType, 2 cột còn lại NULL (workflow-module.md §3.2 FormAccesses).
            entity.HasIndex(e => new { e.FormDefinitionId, e.TargetType, e.RoleId, e.OrgUnitId, e.EmployeeId },
                "IX_FormAccesses_FormDefinitionId_TargetType_RoleId_OrgUnitId_EmployeeId").IsUnique().HasFilter(null);

            entity.HasOne(d => d.FormDefinition).WithMany(p => p.FormAccesses)
                .HasForeignKey(d => d.FormDefinitionId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_FormAccesses_FormDefinitions_FormDefinitionId");

            entity.HasOne(d => d.OrgUnit).WithMany(p => p.FormAccesses)
                .HasForeignKey(d => d.OrgUnitId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_FormAccesses_OrgUnits_OrgUnitId");

            entity.HasOne(d => d.Employee).WithMany(p => p.FormAccesses)
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_FormAccesses_Employees_EmployeeId");
        });

        modelBuilder.Entity<FormRoute>(entity =>
        {
            // Unique filtered: mỗi form tối đa 1 nhánh IsDefault=1 (workflow-module.md §3.2).
            entity.HasIndex(e => e.FormDefinitionId, "IX_FormRoutes_FormDefinitionId_IsDefault_Filtered")
                .IsUnique()
                .HasFilter("[IsDefault] = 1");

            entity.Property(e => e.NameVn).HasMaxLength(200);
            entity.Property(e => e.NameJp).HasMaxLength(200);
            entity.Property(e => e.ClassValue).HasMaxLength(100);
            entity.Property(e => e.MinValue).HasColumnType("decimal(18,4)");
            entity.Property(e => e.MaxValue).HasColumnType("decimal(18,4)");

            entity.HasOne(d => d.FormDefinition).WithMany(p => p.FormRoutes)
                .HasForeignKey(d => d.FormDefinitionId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_FormRoutes_FormDefinitions_FormDefinitionId");
        });

        modelBuilder.Entity<FormApprovalStep>(entity =>
        {
            entity.HasIndex(e => new { e.FormRouteId, e.StepOrder }, "IX_FormApprovalSteps_FormRouteId_StepOrder").IsUnique();

            entity.Property(e => e.NameVn).HasMaxLength(200);
            entity.Property(e => e.NameJp).HasMaxLength(200);
            entity.Property(e => e.AllowSendBack).HasDefaultValue(true);

            entity.HasOne(d => d.FormRoute).WithMany(p => p.FormApprovalSteps)
                .HasForeignKey(d => d.FormRouteId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_FormApprovalSteps_FormRoutes_FormRouteId");

            entity.HasOne(d => d.OrgUnit).WithMany(p => p.FormApprovalSteps)
                .HasForeignKey(d => d.OrgUnitId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_FormApprovalSteps_OrgUnits_OrgUnitId");
        });

        modelBuilder.Entity<FormApprovalStepParticipant>(entity =>
        {
            // .HasFilter(null) giữ đúng NULL=NULL của SQL Server (cùng lý do EmployeeOrgUnits/
            // FormAccesses ở trên) — mỗi dòng chỉ có đúng 1 trong 2 cột đích khác NULL theo
            // ParticipantSource.
            entity.HasIndex(e => new { e.FormApprovalStepId, e.EmployeeId, e.JobTitleId },
                "IX_FormApprovalStepParticipants_FormApprovalStepId_EmployeeId_JobTitleId").IsUnique().HasFilter(null);

            entity.HasOne(d => d.FormApprovalStep).WithMany(p => p.FormApprovalStepParticipants)
                .HasForeignKey(d => d.FormApprovalStepId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_FormApprovalStepParticipants_FormApprovalSteps_FormApprovalStepId");

            entity.HasOne(d => d.Employee).WithMany(p => p.FormApprovalStepParticipants)
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_FormApprovalStepParticipants_Employees_EmployeeId");

            entity.HasOne(d => d.JobTitle).WithMany(p => p.FormApprovalStepParticipants)
                .HasForeignKey(d => d.JobTitleId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_FormApprovalStepParticipants_JobTitles_JobTitleId");
        });

        modelBuilder.Entity<WorkflowRequest>(entity =>
        {
            // Unique filtered: RequestCode NULL cho tới lúc Submit (Pha 3B-1 quyết định #1), nhiều
            // Draft cùng NULL không đụng độ vì SQL Server coi NULL <> NULL trong unique filtered index.
            entity.HasIndex(e => e.RequestCode, "IX_WorkflowRequests_RequestCode").IsUnique().HasFilter("[RequestCode] IS NOT NULL");
            entity.HasIndex(e => new { e.CreatedByEmployeeId, e.Status, e.CreatedAt }, "IX_WorkflowRequests_CreatedByEmployeeId_Status_CreatedAt");
            entity.HasIndex(e => new { e.FormDefinitionId, e.Status }, "IX_WorkflowRequests_FormDefinitionId_Status");

            entity.Property(e => e.RequestCode).HasMaxLength(50);
            entity.Property(e => e.RouteConditionSnapshot).HasMaxLength(200);
            entity.Property(e => e.DataJson).HasColumnType("nvarchar(max)");
            entity.Property(e => e.FormSchemaJson).HasColumnType("nvarchar(max)");

            entity.HasOne(d => d.FormDefinition).WithMany(p => p.WorkflowRequests)
                .HasForeignKey(d => d.FormDefinitionId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_WorkflowRequests_FormDefinitions_FormDefinitionId");

            entity.HasOne(d => d.FormRoute).WithMany(p => p.WorkflowRequests)
                .HasForeignKey(d => d.FormRouteId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_WorkflowRequests_FormRoutes_FormRouteId");

            entity.HasOne(d => d.CreatedByEmployee).WithMany(p => p.CreatedWorkflowRequests)
                .HasForeignKey(d => d.CreatedByEmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_WorkflowRequests_Employees_CreatedByEmployeeId");

            entity.HasOne(d => d.CreatedByOrgUnit).WithMany(p => p.WorkflowRequests)
                .HasForeignKey(d => d.CreatedByOrgUnitId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_WorkflowRequests_OrgUnits_CreatedByOrgUnitId");
        });

        modelBuilder.Entity<WorkflowRequestStep>(entity =>
        {
            entity.HasIndex(e => new { e.WorkflowRequestId, e.StepOrder }, "IX_WorkflowRequestSteps_WorkflowRequestId_StepOrder").IsUnique();
            entity.HasIndex(e => new { e.Status, e.WorkflowRequestId }, "IX_WorkflowRequestSteps_Status_WorkflowRequestId");

            entity.Property(e => e.StepNameSnapshot).HasMaxLength(200);
            entity.Property(e => e.OrgUnitNameSnapshot).HasMaxLength(200);

            entity.HasOne(d => d.WorkflowRequest).WithMany(p => p.WorkflowRequestSteps)
                .HasForeignKey(d => d.WorkflowRequestId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_WorkflowRequestSteps_WorkflowRequests_WorkflowRequestId");

            entity.HasOne(d => d.InsertedByEmployee).WithMany(p => p.InsertedWorkflowRequestSteps)
                .HasForeignKey(d => d.InsertedByEmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_WorkflowRequestSteps_Employees_InsertedByEmployeeId");

            entity.HasOne(d => d.ActedByEmployee).WithMany(p => p.ActedWorkflowRequestSteps)
                .HasForeignKey(d => d.ActedByEmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_WorkflowRequestSteps_Employees_ActedByEmployeeId");
        });

        modelBuilder.Entity<WorkflowRequestStepParticipant>(entity =>
        {
            entity.HasIndex(e => new { e.WorkflowRequestStepId, e.EmployeeId }, "IX_WorkflowRequestStepParticipants_WorkflowRequestStepId_EmployeeId").IsUnique();
            entity.HasIndex(e => e.EmployeeId, "IX_WorkflowRequestStepParticipants_EmployeeId");

            entity.Property(e => e.ResolvedFromJobTitle).HasMaxLength(200);

            entity.HasOne(d => d.WorkflowRequestStep).WithMany(p => p.WorkflowRequestStepParticipants)
                .HasForeignKey(d => d.WorkflowRequestStepId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_WorkflowRequestStepParticipants_WorkflowRequestSteps_WorkflowRequestStepId");

            entity.HasOne(d => d.Employee).WithMany(p => p.WorkflowRequestStepParticipants)
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_WorkflowRequestStepParticipants_Employees_EmployeeId");
        });

        modelBuilder.Entity<WorkflowRequestHistory>(entity =>
        {
            entity.HasIndex(e => new { e.WorkflowRequestId, e.ActionAt }, "IX_WorkflowRequestHistories_WorkflowRequestId_ActionAt");

            entity.Property(e => e.ActorNameSnapshot).HasMaxLength(200);
            entity.Property(e => e.Comment).HasMaxLength(1000);

            entity.HasOne(d => d.WorkflowRequest).WithMany(p => p.WorkflowRequestHistories)
                .HasForeignKey(d => d.WorkflowRequestId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_WorkflowRequestHistories_WorkflowRequests_WorkflowRequestId");

            entity.HasOne(d => d.ActorEmployee).WithMany(p => p.ActorWorkflowRequestHistories)
                .HasForeignKey(d => d.ActorEmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_WorkflowRequestHistories_Employees_ActorEmployeeId");

            entity.HasOne(d => d.OnBehalfOfEmployee).WithMany(p => p.OnBehalfOfWorkflowRequestHistories)
                .HasForeignKey(d => d.OnBehalfOfEmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_WorkflowRequestHistories_Employees_OnBehalfOfEmployeeId");
        });

        modelBuilder.Entity<WorkflowSequence>(entity =>
        {
            entity.HasKey(e => new { e.SequenceKey, e.Year });
            entity.Property(e => e.SequenceKey).HasMaxLength(50);
        });

        modelBuilder.Entity<ApprovalDelegation>(entity =>
        {
            entity.HasIndex(e => new { e.DelegateEmployeeId, e.FromDate, e.ToDate }, "IX_ApprovalDelegations_DelegateEmployeeId_FromDate_ToDate");
            entity.ToTable(t => t.HasCheckConstraint("CK_ApprovalDelegations_DelegatorNotDelegate", "[DelegatorEmployeeId] <> [DelegateEmployeeId]"));

            entity.Property(e => e.Reason).HasMaxLength(500);

            entity.HasOne(d => d.DelegatorEmployee).WithMany(p => p.DelegatorApprovalDelegations)
                .HasForeignKey(d => d.DelegatorEmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_ApprovalDelegations_Employees_DelegatorEmployeeId");

            entity.HasOne(d => d.DelegateEmployee).WithMany(p => p.DelegateApprovalDelegations)
                .HasForeignKey(d => d.DelegateEmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_ApprovalDelegations_Employees_DelegateEmployeeId");

            entity.HasOne(d => d.FormDefinition).WithMany(p => p.ApprovalDelegations)
                .HasForeignKey(d => d.FormDefinitionId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_ApprovalDelegations_FormDefinitions_FormDefinitionId");
        });

        modelBuilder.Entity<EmployeeSignature>(entity =>
        {
            entity.HasIndex(e => e.EmployeeId, "IX_EmployeeSignatures_EmployeeId").IsUnique();

            entity.HasOne(d => d.Employee).WithOne(p => p.EmployeeSignature)
                .HasForeignKey<EmployeeSignature>(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_EmployeeSignatures_Employees_EmployeeId");
        });

        modelBuilder.Entity<PendingEmployeeSignatureConfirmation>(entity =>
        {
            entity.HasIndex(e => e.Token, "IX_PendingEmployeeSignatureConfirmations_Token").IsUnique();
            entity.Property(e => e.Token).HasMaxLength(128);

            entity.HasOne(d => d.Employee).WithMany(p => p.PendingEmployeeSignatureConfirmations)
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_PendingEmployeeSignatureConfirmations_Employees_EmployeeId");
        });

        modelBuilder.Entity<WorkflowAttachment>(entity =>
        {
            entity.HasIndex(e => e.WorkflowRequestId, "IX_WorkflowAttachments_WorkflowRequestId");

            entity.Property(e => e.OriginalFileName).HasMaxLength(255);
            entity.Property(e => e.StoredFileName).HasMaxLength(100);
            entity.Property(e => e.RelativePath).HasMaxLength(300);
            entity.Property(e => e.ContentType).HasMaxLength(100);

            entity.HasOne(d => d.WorkflowRequest).WithMany(p => p.WorkflowAttachments)
                .HasForeignKey(d => d.WorkflowRequestId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_WorkflowAttachments_WorkflowRequests_WorkflowRequestId");

            entity.HasOne(d => d.UploadedByEmployee).WithMany(p => p.UploadedWorkflowAttachments)
                .HasForeignKey(d => d.UploadedByEmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_WorkflowAttachments_Employees_UploadedByEmployeeId");
        });

        modelBuilder.Entity<WorkflowSetting>(entity =>
        {
            // Luôn 1 dòng (Id = 1, seed trong migration) — không cần index nào khác ngoài PK.
            entity.Property(e => e.AllowedFileExtensions).HasMaxLength(500);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}

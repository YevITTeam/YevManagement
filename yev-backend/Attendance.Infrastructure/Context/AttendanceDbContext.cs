using Attendance.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Infrastructure.Context;

public partial class AttendanceDbContext : DbContext
{
    public AttendanceDbContext()
    {
    }

    public AttendanceDbContext(DbContextOptions<AttendanceDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Department> Departments { get; set; }
    public virtual DbSet<Group> Groups { get; set; }
    public virtual DbSet<Reason> Reasons { get; set; }
    public virtual DbSet<OtCase> OtCases { get; set; }
    public virtual DbSet<Employee> Employees { get; set; }
    public virtual DbSet<OtForm> OtForms { get; set; }
    public virtual DbSet<OtFormEmployee> OtFormEmployees { get; set; }
    public virtual DbSet<ProcessPart> ProcessParts { get; set; }
    public virtual DbSet<OtFormApprovalHistory> OtFormApprovalHistories { get; set; }
    public virtual DbSet<UserSignature> UserSignatures { get; set; }
    public virtual DbSet<PendingSignatureConfirmation> PendingSignatureConfirmations { get; set; }
    public virtual DbSet<OtFormApprovalEmailToken> OtFormApprovalEmailTokens { get; set; }
    public virtual DbSet<SecondaryPassword> SecondaryPasswords { get; set; }
    public virtual DbSet<PendingSecondaryPasswordConfirmation> PendingSecondaryPasswordConfirmations { get; set; }
    public virtual DbSet<AttendanceSetting> AttendanceSettings { get; set; }
    public virtual DbSet<OtFormBatch> OtFormBatches { get; set; }
    public virtual DbSet<OtFormBatchEmailToken> OtFormBatchEmailTokens { get; set; }
    public virtual DbSet<JobTitle> JobTitles { get; set; }
    public virtual DbSet<DepartmentApprovalStep> DepartmentApprovalSteps { get; set; }
    public virtual DbSet<GroupApprovalStep> GroupApprovalSteps { get; set; }
    public virtual DbSet<OtFormApprovalStep> OtFormApprovalSteps { get; set; }
    public virtual DbSet<OtFormApprovalStepCandidate> OtFormApprovalStepCandidates { get; set; }
    public virtual DbSet<JobTitlePermission> JobTitlePermissions { get; set; }
    public virtual DbSet<DepartmentApprovalStepCoordinator> DepartmentApprovalStepCoordinators { get; set; }
    public virtual DbSet<GroupApprovalStepCoordinator> GroupApprovalStepCoordinators { get; set; }
    public virtual DbSet<EmployeeAccumulationHistory> EmployeeAccumulationHistories { get; set; }
    public virtual DbSet<ProductionLine> ProductionLines { get; set; }
    public virtual DbSet<ProductionShiftTeam> ProductionShiftTeams { get; set; }
    public virtual DbSet<ProductionTeam> ProductionTeams { get; set; }
    public virtual DbSet<ProductionEmployee> ProductionEmployees { get; set; }
    public virtual DbSet<ProductionApprovalStep> ProductionApprovalSteps { get; set; }
    public virtual DbSet<OtFormEditLog> OtFormEditLogs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AttendanceSetting>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_AttendanceSettings");
            // decimal(5,2) đủ cho mốc giờ phiếu ăn (vd 2.50), decimal(10,2) cho giới hạn lũy kế
            // tháng/năm — cùng kiểu với Employee.MonthToDate/YearToDate để so sánh không bị lệch.
            entity.Property(e => e.MainMealTicketMinHours).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.NoMealTicketMaxHours).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.MealBreakDeductionHours).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.DailyOtHourLimit).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.MonthlyOtHourLimit).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.YearlyOtHourLimit).HasColumnType("decimal(10, 2)");
        });

        modelBuilder.Entity<Department>(entity =>
        {
            entity.HasIndex(e => e.DepartmentCode, "IX_Departments_DepartmentCode").IsUnique();
            entity.Property(e => e.DepartmentCode).HasMaxLength(50);
            entity.Property(e => e.DepartmentNameVn).HasMaxLength(255);
            entity.Property(e => e.DepartmentNameJp).HasMaxLength(255);
        });

        modelBuilder.Entity<Group>(entity =>
        {
            entity.HasIndex(e => e.GroupCode, "IX_Groups_GroupCode").IsUnique();
            entity.HasIndex(e => e.DepartmentId, "IX_Groups_DepartmentId");
            entity.Property(e => e.GroupCode).HasMaxLength(50);
            entity.Property(e => e.GroupNameVn).HasMaxLength(255);
            entity.Property(e => e.GroupNameJp).HasMaxLength(255);

            entity.HasOne(d => d.Department).WithMany(p => p.Groups)
                .HasForeignKey(d => d.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Groups_Departments_DepartmentId");
        });

        modelBuilder.Entity<Reason>(entity =>
        {
            entity.Property(e => e.ReasonNameVn).HasMaxLength(255);
            entity.Property(e => e.ReasonNameJp).HasMaxLength(255);
        });

        modelBuilder.Entity<OtCase>(entity =>
        {
            entity.HasIndex(e => e.Code, "IX_OtCases_Code").IsUnique();
            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.Description).HasMaxLength(500);
        });

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.HasIndex(e => e.Code, "IX_Employees_Code").IsUnique();
            entity.HasIndex(e => e.GroupId, "IX_Employees_GroupId");
            entity.HasIndex(e => e.DepartmentId, "IX_Employees_DepartmentId");
            entity.HasIndex(e => e.JobTitleId, "IX_Employees_JobTitleId");
            // Filtered unique index: SQL Server only allows 1 NULL in a regular unique index,
            // so filter IS NOT NULL to let multiple employees without an assigned UserName still be insertable.
            entity.HasIndex(e => e.UserName, "IX_Employees_UserName").IsUnique().HasFilter("[UserName] IS NOT NULL");

            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.FirstName).HasMaxLength(150);
            entity.Property(e => e.LastName).HasMaxLength(150);
            entity.Property(e => e.UserName).HasMaxLength(100);
            // decimal(10,2) — cùng kiểu với AttendanceSetting.MonthlyOtHourLimit/YearlyOtHourLimit để
            // so sánh không bị lệch.
            entity.Property(e => e.CustomMonthlyOtHourLimit).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.CustomYearlyOtHourLimit).HasColumnType("decimal(10, 2)");

            entity.HasOne(d => d.Group).WithMany(p => p.Employees)
                .HasForeignKey(d => d.GroupId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Employees_Groups_GroupId");

            entity.HasOne(d => d.Department).WithMany()
                .HasForeignKey(d => d.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Employees_Departments_DepartmentId");

            entity.HasOne(d => d.JobTitle).WithMany(p => p.Employees)
                .HasForeignKey(d => d.JobTitleId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Employees_JobTitles_JobTitleId");
        });

        modelBuilder.Entity<JobTitle>(entity =>
        {
            entity.HasIndex(e => e.Code, "IX_JobTitles_Code").IsUnique();
            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.Name).HasMaxLength(150);
        });

        modelBuilder.Entity<DepartmentApprovalStep>(entity =>
        {
            entity.HasIndex(e => e.DepartmentId, "IX_DepartmentApprovalSteps_DepartmentId");
            entity.HasIndex(e => e.JobTitleId, "IX_DepartmentApprovalSteps_JobTitleId");

            entity.HasOne(d => d.Department).WithMany(p => p.DepartmentApprovalSteps)
                .HasForeignKey(d => d.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_DepartmentApprovalSteps_Departments_DepartmentId");

            entity.HasOne(d => d.JobTitle).WithMany(p => p.DepartmentApprovalSteps)
                .HasForeignKey(d => d.JobTitleId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_DepartmentApprovalSteps_JobTitles_JobTitleId");
        });

        modelBuilder.Entity<GroupApprovalStep>(entity =>
        {
            entity.HasIndex(e => e.GroupId, "IX_GroupApprovalSteps_GroupId");
            entity.HasIndex(e => e.JobTitleId, "IX_GroupApprovalSteps_JobTitleId");

            entity.HasOne(d => d.Group).WithMany(p => p.GroupApprovalSteps)
                .HasForeignKey(d => d.GroupId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_GroupApprovalSteps_Groups_GroupId");

            entity.HasOne(d => d.JobTitle).WithMany(p => p.GroupApprovalSteps)
                .HasForeignKey(d => d.JobTitleId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_GroupApprovalSteps_JobTitles_JobTitleId");
        });

        modelBuilder.Entity<JobTitlePermission>(entity =>
        {
            entity.HasIndex(e => e.JobTitleId, "IX_JobTitlePermissions_JobTitleId");

            entity.Property(e => e.PermissionCode).HasMaxLength(200);

            entity.HasOne(d => d.JobTitle).WithMany(p => p.JobTitlePermissions)
                .HasForeignKey(d => d.JobTitleId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_JobTitlePermissions_JobTitles_JobTitleId");
        });

        modelBuilder.Entity<DepartmentApprovalStepCoordinator>(entity =>
        {
            entity.HasIndex(e => e.DepartmentId, "IX_DepartmentApprovalStepCoordinators_DepartmentId");
            entity.HasIndex(e => e.EmployeeId, "IX_DepartmentApprovalStepCoordinators_EmployeeId");

            entity.HasOne(d => d.Department).WithMany(p => p.DepartmentApprovalStepCoordinators)
                .HasForeignKey(d => d.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_DepartmentApprovalStepCoordinators_Departments_DepartmentId");

            entity.HasOne(d => d.Employee).WithMany()
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_DepartmentApprovalStepCoordinators_Employees_EmployeeId");
        });

        modelBuilder.Entity<GroupApprovalStepCoordinator>(entity =>
        {
            entity.HasIndex(e => e.GroupId, "IX_GroupApprovalStepCoordinators_GroupId");
            entity.HasIndex(e => e.EmployeeId, "IX_GroupApprovalStepCoordinators_EmployeeId");

            entity.HasOne(d => d.Group).WithMany(p => p.GroupApprovalStepCoordinators)
                .HasForeignKey(d => d.GroupId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_GroupApprovalStepCoordinators_Groups_GroupId");

            entity.HasOne(d => d.Employee).WithMany()
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_GroupApprovalStepCoordinators_Employees_EmployeeId");
        });

        modelBuilder.Entity<EmployeeAccumulationHistory>(entity =>
        {
            entity.HasIndex(e => new { e.EmployeeId, e.Year, e.Month }, "IX_EmployeeAccumulationHistories_EmployeeId_Year_Month").IsUnique();

            entity.Property(e => e.TotalHours).HasPrecision(10, 2);
            entity.Property(e => e.Note).HasMaxLength(1000);

            entity.HasOne(d => d.Employee).WithMany(p => p.EmployeeAccumulationHistories)
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_EmployeeAccumulationHistories_Employees_EmployeeId");
        });

        modelBuilder.Entity<OtForm>(entity =>
        {
            entity.HasIndex(e => e.GroupId, "IX_OtForms_GroupId");
            entity.HasIndex(e => e.DepartmentId, "IX_OtForms_DepartmentId");
            entity.HasIndex(e => e.ReasonId, "IX_OtForms_ReasonId");
            entity.HasIndex(e => e.OtCaseId, "IX_OtForms_OtCaseId");
            entity.HasIndex(e => e.CreatedByUserName, "IX_OtForms_CreatedByUserName");
            entity.HasIndex(e => e.Status, "IX_OtForms_Status");

            entity.Property(e => e.CreatedByUserName).HasMaxLength(100);
            entity.Property(e => e.CreatedByFullName).HasMaxLength(255);
            entity.Property(e => e.SubReason).HasMaxLength(500);
            entity.Property(e => e.TotalHour).HasPrecision(10, 2);
            entity.Property(e => e.DeletedByUserName).HasMaxLength(100);
            entity.Property(e => e.DeletedByFullName).HasMaxLength(255);
            entity.Property(e => e.DeleteReason).HasMaxLength(500);

            entity.HasOne(d => d.Group).WithMany(p => p.OtForms)
                .HasForeignKey(d => d.GroupId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtForms_Groups_GroupId");

            entity.HasOne(d => d.Department).WithMany(p => p.OtForms)
                .HasForeignKey(d => d.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtForms_Departments_DepartmentId");

            entity.HasOne(d => d.Reason).WithMany(p => p.OtForms)
                .HasForeignKey(d => d.ReasonId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtForms_Reasons_ReasonId");

            entity.HasOne(d => d.OtCase).WithMany(p => p.OtForms)
                .HasForeignKey(d => d.OtCaseId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtForms_OtCases_OtCaseId");

            entity.HasOne(d => d.OtFormBatch).WithMany(p => p.OtForms)
                .HasForeignKey(d => d.OtFormBatchId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtForms_OtFormBatches_OtFormBatchId");
        });

        modelBuilder.Entity<OtFormEmployee>(entity =>
        {
            entity.HasKey(e => new { e.OtFormId, e.EmployeeId }).HasName("PK_OtFormEmployees");
            entity.HasIndex(e => e.EmployeeId, "IX_OtFormEmployees_EmployeeId");

            entity.Property(e => e.NoteVn).HasMaxLength(500);
            entity.Property(e => e.NoteJp).HasMaxLength(500);
            entity.Property(e => e.MonthToDate).HasPrecision(10, 2);
            entity.Property(e => e.YearToDate).HasPrecision(10, 2);
            entity.Property(e => e.RemovedByUserName).HasMaxLength(100);
            entity.Property(e => e.RemovedByFullName).HasMaxLength(255);
            entity.Property(e => e.RemoveReason).HasMaxLength(500);

            entity.HasOne(d => d.OtForm).WithMany(p => p.OtFormEmployees)
                .HasForeignKey(d => d.OtFormId)
                .HasConstraintName("FK_OtFormEmployees_OtForms_OtFormId");

            entity.HasOne(d => d.Employee).WithMany(p => p.OtFormEmployees)
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtFormEmployees_Employees_EmployeeId");
        });

        modelBuilder.Entity<ProcessPart>(entity =>
        {
            entity.HasIndex(e => e.OtFormId, "IX_ProcessParts_OtFormId").IsUnique();
            entity.Property(e => e.AnotherSuggestionVn).HasMaxLength(500);
            entity.Property(e => e.AnotherSuggestionJp).HasMaxLength(500);

            entity.HasOne(d => d.OtForm).WithOne(p => p.ProcessPart)
                .HasForeignKey<ProcessPart>(d => d.OtFormId)
                .HasConstraintName("FK_ProcessParts_OtForms_OtFormId");
        });

        modelBuilder.Entity<OtFormApprovalHistory>(entity =>
        {
            entity.HasIndex(e => e.OtFormId, "IX_OtFormApprovalHistories_OtFormId");
            entity.HasIndex(e => e.ApproverUserName, "IX_OtFormApprovalHistories_ApproverUserName");

            entity.Property(e => e.ApproverUserName).HasMaxLength(100);
            entity.Property(e => e.ApproverFullName).HasMaxLength(255);
            entity.Property(e => e.Comment).HasMaxLength(500);

            entity.HasOne(d => d.OtForm).WithMany(p => p.OtFormApprovalHistories)
                .HasForeignKey(d => d.OtFormId)
                .HasConstraintName("FK_OtFormApprovalHistories_OtForms_OtFormId");

            entity.HasOne(d => d.OtFormApprovalStep).WithMany(p => p.ApprovalHistories)
                .HasForeignKey(d => d.OtFormApprovalStepId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtFormApprovalHistories_OtFormApprovalSteps_OtFormApprovalStepId");
        });

        modelBuilder.Entity<OtFormEditLog>(entity =>
        {
            entity.HasIndex(e => e.OtFormId, "IX_OtFormEditLogs_OtFormId");

            entity.Property(e => e.ActionByUserName).HasMaxLength(100);
            entity.Property(e => e.ActionByFullName).HasMaxLength(255);
            entity.Property(e => e.EmployeeCodeSnapshot).HasMaxLength(50);
            entity.Property(e => e.FieldName).HasMaxLength(50);
            entity.Property(e => e.OldValue).HasMaxLength(500);
            entity.Property(e => e.NewValue).HasMaxLength(500);

            entity.HasOne(d => d.OtForm).WithMany(p => p.OtFormEditLogs)
                .HasForeignKey(d => d.OtFormId)
                .HasConstraintName("FK_OtFormEditLogs_OtForms_OtFormId");
        });

        modelBuilder.Entity<UserSignature>(entity =>
        {
            entity.HasIndex(e => e.UserName, "IX_UserSignatures_UserName").IsUnique();
            entity.Property(e => e.UserName).HasMaxLength(100);
        });

        modelBuilder.Entity<PendingSignatureConfirmation>(entity =>
        {
            entity.HasIndex(e => e.Token, "IX_PendingSignatureConfirmations_Token").IsUnique();
            entity.HasIndex(e => e.UserName, "IX_PendingSignatureConfirmations_UserName");
            entity.Property(e => e.UserName).HasMaxLength(100);
            entity.Property(e => e.Token).HasMaxLength(64);
        });

        modelBuilder.Entity<OtFormApprovalEmailToken>(entity =>
        {
            entity.HasIndex(e => e.Token, "IX_OtFormApprovalEmailTokens_Token").IsUnique();
            entity.HasIndex(e => e.OtFormId, "IX_OtFormApprovalEmailTokens_OtFormId");

            entity.Property(e => e.ApproverUserName).HasMaxLength(100);
            entity.Property(e => e.ApproverFullName).HasMaxLength(255);
            entity.Property(e => e.Token).HasMaxLength(64);

            entity.HasOne(d => d.OtForm).WithMany(p => p.OtFormApprovalEmailTokens)
                .HasForeignKey(d => d.OtFormId)
                .HasConstraintName("FK_OtFormApprovalEmailTokens_OtForms_OtFormId");

            entity.HasOne(d => d.OtFormApprovalStep).WithMany(p => p.ApprovalEmailTokens)
                .HasForeignKey(d => d.OtFormApprovalStepId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtFormApprovalEmailTokens_OtFormApprovalSteps_OtFormApprovalStepId");
        });

        modelBuilder.Entity<OtFormApprovalStep>(entity =>
        {
            entity.HasIndex(e => e.OtFormId, "IX_OtFormApprovalSteps_OtFormId");
            entity.HasIndex(e => e.JobTitleId, "IX_OtFormApprovalSteps_JobTitleId");
            entity.Property(e => e.JobTitleCodeSnapshot).HasMaxLength(50);
            entity.Property(e => e.JobTitleNameSnapshot).HasMaxLength(150);

            entity.HasOne(d => d.OtForm).WithMany(p => p.ApprovalSteps)
                .HasForeignKey(d => d.OtFormId)
                .HasConstraintName("FK_OtFormApprovalSteps_OtForms_OtFormId");

            entity.HasOne(d => d.JobTitle).WithMany()
                .HasForeignKey(d => d.JobTitleId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtFormApprovalSteps_JobTitles_JobTitleId");
        });

        modelBuilder.Entity<OtFormApprovalStepCandidate>(entity =>
        {
            entity.HasIndex(e => e.OtFormApprovalStepId, "IX_OtFormApprovalStepCandidates_OtFormApprovalStepId");
            entity.HasIndex(e => e.EmployeeId, "IX_OtFormApprovalStepCandidates_EmployeeId");
            entity.Property(e => e.UserName).HasMaxLength(100);
            entity.Property(e => e.FullName).HasMaxLength(255);

            entity.HasOne(d => d.OtFormApprovalStep).WithMany(p => p.Candidates)
                .HasForeignKey(d => d.OtFormApprovalStepId)
                .HasConstraintName("FK_OtFormApprovalStepCandidates_OtFormApprovalSteps_OtFormApprovalStepId");
        });

        modelBuilder.Entity<SecondaryPassword>(entity =>
        {
            entity.HasIndex(e => e.UserName, "IX_SecondaryPasswords_UserName").IsUnique();
            entity.Property(e => e.UserName).HasMaxLength(100);
            entity.Property(e => e.PasswordHash).HasMaxLength(200);
        });

        modelBuilder.Entity<PendingSecondaryPasswordConfirmation>(entity =>
        {
            entity.HasIndex(e => e.Token, "IX_PendingSecondaryPasswordConfirmations_Token").IsUnique();
            entity.HasIndex(e => e.UserName, "IX_PendingSecondaryPasswordConfirmations_UserName");
            entity.Property(e => e.UserName).HasMaxLength(100);
            entity.Property(e => e.PasswordHash).HasMaxLength(200);
            entity.Property(e => e.Token).HasMaxLength(64);
        });

        modelBuilder.Entity<OtFormBatch>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_OtFormBatches");
            entity.HasIndex(e => e.DepartmentId, "IX_OtFormBatches_DepartmentId");
            entity.HasIndex(e => e.Status, "IX_OtFormBatches_Status");

            entity.Property(e => e.ProcessedByUserName).HasMaxLength(100);
            entity.Property(e => e.ProcessedByFullName).HasMaxLength(255);

            entity.HasOne(d => d.Department).WithMany()
                .HasForeignKey(d => d.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtFormBatches_Departments_DepartmentId");
        });

        modelBuilder.Entity<OtFormBatchEmailToken>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_OtFormBatchEmailTokens");
            entity.HasIndex(e => e.Token, "IX_OtFormBatchEmailTokens_Token").IsUnique();
            entity.HasIndex(e => e.OtFormBatchId, "IX_OtFormBatchEmailTokens_OtFormBatchId");

            entity.Property(e => e.ApproverUserName).HasMaxLength(100);
            entity.Property(e => e.ApproverFullName).HasMaxLength(255);
            entity.Property(e => e.Token).HasMaxLength(64);

            entity.HasOne(d => d.OtFormBatch).WithMany(p => p.OtFormBatchEmailTokens)
                .HasForeignKey(d => d.OtFormBatchId)
                .HasConstraintName("FK_OtFormBatchEmailTokens_OtFormBatches_OtFormBatchId");
        });

        modelBuilder.Entity<ProductionLine>(entity =>
        {
            entity.Property(e => e.LineCode).HasMaxLength(50);
            entity.Property(e => e.CongDoan).HasMaxLength(50);

            entity.HasOne(d => d.Team).WithMany(p => p.ProductionLines)
                .HasForeignKey(d => d.TeamId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_ProductionLines_ProductionTeams_TeamId");
        });

        modelBuilder.Entity<ProductionTeam>(entity =>
        {
            entity.Property(e => e.Code).HasMaxLength(20);
            entity.Property(e => e.NameVn).HasMaxLength(100);
        });

        modelBuilder.Entity<ProductionShiftTeam>(entity =>
        {
            entity.Property(e => e.Code).HasMaxLength(20);
            entity.Property(e => e.NameVn).HasMaxLength(100);
        });

        modelBuilder.Entity<ProductionEmployee>(entity =>
        {
            entity.Property(e => e.EmployeeCode).HasMaxLength(50);
            entity.Property(e => e.LastNameSnapshot).HasMaxLength(150);
            entity.Property(e => e.FirstNameSnapshot).HasMaxLength(150);
            entity.Property(e => e.CongDoan).HasMaxLength(50);
            entity.Property(e => e.TaskName).HasMaxLength(255);
            entity.Property(e => e.BlockCode).HasMaxLength(50);
            entity.Property(e => e.TeamCode).HasMaxLength(20);
            entity.Property(e => e.ShiftTeamCode).HasMaxLength(20);

            entity.HasIndex(e => e.EmployeeCode).IsUnique();

            entity.HasOne(d => d.ProductionLine).WithMany(p => p.ProductionEmployees)
                .HasForeignKey(d => d.ProductionLineId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_ProductionEmployees_ProductionLines_ProductionLineId");

            entity.HasOne(d => d.Team).WithMany(p => p.ProductionEmployees)
                .HasForeignKey(d => d.TeamId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_ProductionEmployees_ProductionTeams_TeamId");

            entity.HasOne(d => d.ShiftTeam).WithMany(p => p.ProductionEmployees)
                .HasForeignKey(d => d.ShiftTeamId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_ProductionEmployees_ProductionShiftTeams_ShiftTeamId");

            entity.HasOne(d => d.Employee).WithMany(p => p.ProductionEmployees)
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_ProductionEmployees_Employees_EmployeeId");
        });

        modelBuilder.Entity<ProductionApprovalStep>(entity =>
        {
            entity.HasIndex(e => e.DepartmentId, "IX_ProductionApprovalSteps_DepartmentId");
            entity.HasIndex(e => e.JobTitleId, "IX_ProductionApprovalSteps_JobTitleId");

            entity.HasOne(d => d.Department).WithMany(p => p.ProductionApprovalSteps)
                .HasForeignKey(d => d.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_ProductionApprovalSteps_Departments_DepartmentId");

            entity.HasOne(d => d.JobTitle).WithMany(p => p.ProductionApprovalSteps)
                .HasForeignKey(d => d.JobTitleId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_ProductionApprovalSteps_JobTitles_JobTitleId");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}

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
    public virtual DbSet<UserApprovalScope> UserApprovalScopes { get; set; }
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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AttendanceSetting>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_AttendanceSettings");
            // decimal(5,2) đủ cho mốc giờ phiếu ăn (vd 2.50), decimal(10,2) cho giới hạn lũy kế
            // tháng/năm — cùng kiểu với Employee.MonthToDate/YearToDate để so sánh không bị lệch.
            entity.Property(e => e.MainMealTicketMinHours).HasColumnType("decimal(5, 2)");
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

            entity.HasOne(d => d.RequesterEmployee).WithMany()
                .HasForeignKey(d => d.RequesterEmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Groups_Employees_Requester");

            entity.HasOne(d => d.ResponsibleEmployee).WithMany()
                .HasForeignKey(d => d.ResponsibleEmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Groups_Employees_Responsible");
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
            entity.HasIndex(e => e.JobTitleId, "IX_Employees_JobTitleId");
            // Filtered unique index: SQL Server only allows 1 NULL in a regular unique index,
            // so filter IS NOT NULL to let multiple employees without an assigned UserName still be insertable.
            entity.HasIndex(e => e.UserName, "IX_Employees_UserName").IsUnique().HasFilter("[UserName] IS NOT NULL");

            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.FirstName).HasMaxLength(150);
            entity.Property(e => e.LastName).HasMaxLength(150);
            entity.Property(e => e.UserName).HasMaxLength(100);
            entity.Property(e => e.MonthToDate).HasPrecision(10, 2);
            entity.Property(e => e.YearToDate).HasPrecision(10, 2);
            entity.Property(e => e.ProjectedMonthToDate).HasPrecision(10, 2);
            entity.Property(e => e.ProjectedYearToDate).HasPrecision(10, 2);

            entity.HasOne(d => d.Group).WithMany(p => p.Employees)
                .HasForeignKey(d => d.GroupId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Employees_Groups_GroupId");

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
            entity.Property(e => e.RequesterFullName).HasMaxLength(100);
            entity.Property(e => e.RequesterUserName).HasMaxLength(50);
            entity.Property(e => e.ResponsibleFullName).HasMaxLength(100);
            entity.Property(e => e.ResponsibleUserName).HasMaxLength(50);
            entity.Property(e => e.SubReason).HasMaxLength(500);
            entity.Property(e => e.TotalHour).HasPrecision(10, 2);

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

        modelBuilder.Entity<UserApprovalScope>(entity =>
        {
            entity.HasIndex(e => new { e.ScopeType, e.ScopeId }, "IX_UserApprovalScopes_ScopeType_ScopeId");
            entity.HasIndex(e => e.UserName, "IX_UserApprovalScopes_UserName");
            entity.Property(e => e.UserName).HasMaxLength(100);
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

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}

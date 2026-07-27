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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
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
            // Filtered unique index: SQL Server only allows 1 NULL in a regular unique index,
            // so filter IS NOT NULL to let multiple employees without an assigned UserName still be insertable.
            entity.HasIndex(e => e.UserName, "IX_Employees_UserName").IsUnique().HasFilter("[UserName] IS NOT NULL");

            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.FirstName).HasMaxLength(150);
            entity.Property(e => e.LastName).HasMaxLength(150);
            entity.Property(e => e.UserName).HasMaxLength(100);
            entity.Property(e => e.MonthToDate).HasPrecision(10, 2);
            entity.Property(e => e.YearToDate).HasPrecision(10, 2);

            entity.HasOne(d => d.Group).WithMany(p => p.Employees)
                .HasForeignKey(d => d.GroupId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Employees_Groups_GroupId");
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
        });

        modelBuilder.Entity<OtFormEmployee>(entity =>
        {
            entity.HasKey(e => new { e.OtFormId, e.EmployeeId }).HasName("PK_OtFormEmployees");
            entity.HasIndex(e => e.EmployeeId, "IX_OtFormEmployees_EmployeeId");

            entity.Property(e => e.NoteVn).HasMaxLength(500);
            entity.Property(e => e.NoteJp).HasMaxLength(500);
            entity.Property(e => e.MonthToDate).HasPrecision(10, 2);
            entity.Property(e => e.YearToDate).HasPrecision(10, 2);

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

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}

using System.Text.Encodings.Web;
using System.Text.Json;
using Attendance.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.Extensions.Logging;
using Shared.Application.Helper;

namespace Attendance.Infrastructure.Context;

// Same mechanism as AssetDbContext.AuditTrail: every tracked Create/Update/Delete is logged in SaveChangesAsync,
// and one table + action inside one SaveChanges collapses into a single row with AffectedCount.
public partial class AttendanceDbContext
{
    private readonly IHttpContextAccessor? _auditHttpContextAccessor;
    private readonly ILogger<AttendanceDbContext>? _auditLogger;

    // Logs themselves, short-lived tokens, and the approval-chain snapshot (derived from configuration).
    private static readonly HashSet<Type> AuditExcludedTypes = new()
    {
        typeof(AttendanceAuditTrail),
        typeof(AttendanceMailLog),
        typeof(GeneralAffairsDispatch),
        typeof(OtFormApprovalHistory),
        typeof(OtFormEditLog),
        typeof(OtFormApprovalEmailToken),
        typeof(OtFormBatchEmailToken),
        typeof(PendingSignatureConfirmation),
        typeof(PendingSecondaryPasswordConfirmation),
        typeof(OtFormApprovalStepCandidate)
    };

    private static readonly HashSet<string> MaskedProperties = new() { nameof(SecondaryPassword.PasswordHash) };

    private const int MaxNamesInGroupedEntry = 50;

    // Keeps Vietnamese readable in the stored JSON instead of \u escapes.
    private static readonly JsonSerializerOptions AuditJsonOptions = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public AttendanceDbContext(
        DbContextOptions<AttendanceDbContext> options,
        IHttpContextAccessor httpContextAccessor,
        ILogger<AttendanceDbContext> logger) : base(options)
    {
        _auditHttpContextAccessor = httpContextAccessor;
        _auditLogger = logger;
    }

    private sealed class PendingAudit
    {
        public required EntityEntry Entry { get; init; }
        public required string TableName { get; init; }
        public required string Action { get; init; }
        public int? RecordId { get; set; }
        public Dictionary<string, object?>? OldValues { get; init; }
        public Dictionary<string, object?>? NewValues { get; set; }
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ChangeTracker.DetectChanges();

        var pendings = new List<PendingAudit>();
        foreach (var entry in ChangeTracker.Entries())
        {
            var entityType = entry.Entity.GetType();
            if (AuditExcludedTypes.Contains(entityType)) continue;

            switch (entry.State)
            {
                case EntityState.Added:
                    pendings.Add(new PendingAudit
                    {
                        Entry = entry,
                        TableName = entityType.Name,
                        Action = "Create",
                        NewValues = Snapshot(entry, useOriginalValue: false)
                    });
                    break;

                case EntityState.Modified:
                    var (oldValues, newValues) = DiffModifiedProperties(entry);
                    if (oldValues.Count == 0) break;
                    pendings.Add(new PendingAudit
                    {
                        Entry = entry,
                        TableName = entityType.Name,
                        Action = DetectModifiedAction(entry),
                        RecordId = ReadPrimaryKey(entry, useOriginalValue: false),
                        OldValues = oldValues,
                        NewValues = newValues
                    });
                    break;

                case EntityState.Deleted:
                    pendings.Add(new PendingAudit
                    {
                        Entry = entry,
                        TableName = entityType.Name,
                        Action = "Delete",
                        RecordId = ReadPrimaryKey(entry, useOriginalValue: true),
                        OldValues = Snapshot(entry, useOriginalValue: true)
                    });
                    break;
            }
        }

        // Business data first: Added rows only get their identity Id from this save.
        var result = await base.SaveChangesAsync(cancellationToken);
        if (pendings.Count == 0) return result;

        List<AttendanceAuditTrail> audits = [];
        try
        {
            // Added rows were snapshotted with EF's temporary key; re-read them now that the real Id exists.
            foreach (var pending in pendings.Where(p => p.RecordId is null))
            {
                pending.RecordId = ReadPrimaryKey(pending.Entry, useOriginalValue: false);
                pending.NewValues = Snapshot(pending.Entry, useOriginalValue: false);
            }

            var employees = await LoadEmployeeLabelsAsync(pendings, cancellationToken);
            audits = BuildAuditTrails(pendings, employees);
            AttendanceAuditTrails.AddRange(audits);
            await base.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            // Best-effort: a logging failure must not fail data that is already saved, nor be retried by the next save.
            foreach (var audit in audits) Entry(audit).State = EntityState.Detached;
            _auditLogger?.LogError(ex, "Ghi AttendanceAuditTrail thất bại sau khi lưu dữ liệu chính.");
        }

        return result;
    }

    // Composite keys (OtFormEmployee) keep the first column, so a form's rows are found by its Id.
    private static int? ReadPrimaryKey(EntityEntry entry, bool useOriginalValue)
    {
        var pkProperty = entry.Metadata.FindPrimaryKey()?.Properties[0];
        if (pkProperty is null) return null;

        var property = entry.Property(pkProperty.Name);
        var value = useOriginalValue ? property.OriginalValue : property.CurrentValue;
        return value is null ? 0 : Convert.ToInt32(value);
    }

    // RowVersion changes on every save and says nothing to a reader.
    private static bool IsAuditable(PropertyEntry property) => property.Metadata.ValueGenerated != Microsoft.EntityFrameworkCore.Metadata.ValueGenerated.OnAddOrUpdate;

    private static object? Mask(PropertyEntry property, object? value)
    {
        if (value is null) return null;
        if (MaskedProperties.Contains(property.Metadata.Name)) return "***";
        return value is byte[] ? "(ảnh)" : value;
    }

    private static Dictionary<string, object?> Snapshot(EntityEntry entry, bool useOriginalValue) =>
        entry.Properties.Where(IsAuditable).ToDictionary(
            p => p.Metadata.Name,
            p => Mask(p, useOriginalValue ? p.OriginalValue : p.CurrentValue));

    private static (Dictionary<string, object?> oldValues, Dictionary<string, object?> newValues) DiffModifiedProperties(EntityEntry entry)
    {
        var oldValues = new Dictionary<string, object?>();
        var newValues = new Dictionary<string, object?>();

        foreach (var property in entry.Properties.Where(IsAuditable))
        {
            if (Equals(property.OriginalValue, property.CurrentValue)) continue;
            oldValues[property.Metadata.Name] = Mask(property, property.OriginalValue);
            newValues[property.Metadata.Name] = Mask(property, property.CurrentValue);
        }

        return (oldValues, newValues);
    }

    private static string DetectModifiedAction(EntityEntry entry)
    {
        var isDeleted = entry.Properties.FirstOrDefault(p => p.Metadata.Name == "IsDeleted");
        if (isDeleted == null) return "Update";

        var was = isDeleted.OriginalValue is true;
        var now = isDeleted.CurrentValue is true;
        if (!was && now) return "Delete";
        if (was && !now) return "Restore";
        return "Update";
    }

    private async Task<Dictionary<int, string>> LoadEmployeeLabelsAsync(List<PendingAudit> pendings, CancellationToken cancellationToken)
    {
        var ids = pendings.SelectMany(p => ReferencedEmployeeIds(p.Entry.Entity)).Distinct().ToList();
        if (ids.Count == 0) return new Dictionary<int, string>();

        return await Employees.AsNoTracking()
            .Where(e => ids.Contains(e.Id))
            .Select(e => new { e.Id, e.Code, e.LastName, e.FirstName })
            .ToDictionaryAsync(e => e.Id, e => $"{e.Code} - {e.LastName} {e.FirstName}", cancellationToken);
    }

    private static IEnumerable<int> ReferencedEmployeeIds(object entity)
    {
        switch (entity)
        {
            case OtFormEmployee x: yield return x.EmployeeId; break;
            case EmployeeAccumulationHistory x: yield return x.EmployeeId; break;
            case EmployeeApprovalScope x: yield return x.EmployeeId; break;
            case GroupBorrowedApprover x: yield return x.EmployeeId; break;
            case DepartmentApprovalStepCoordinator x: yield return x.EmployeeId; break;
            case GroupApprovalStepCoordinator x: yield return x.EmployeeId; break;
            case ApprovalDelegation x:
                yield return x.DelegatorEmployeeId;
                yield return x.DelegateEmployeeId;
                break;
        }
    }

    private List<AttendanceAuditTrail> BuildAuditTrails(List<PendingAudit> pendings, Dictionary<int, string> employees)
    {
        var context = _auditHttpContextAccessor?.HttpContext;
        // Anonymous requests are the public email-confirmation links; the signer is in OtFormApprovalHistory.
        var changedBy = context?.User?.Identity?.Name ?? (context is null ? "System" : "EmailLink");
        var changedAt = TimeHelper.GetCurrentUtcTime();
        var audits = new List<AttendanceAuditTrail>();

        foreach (var group in pendings.GroupBy(p => new { p.TableName, p.Action }))
        {
            var items = group.ToList();
            if (items.Count == 1)
            {
                var single = items[0];
                audits.Add(new AttendanceAuditTrail
                {
                    TableName = single.TableName,
                    RecordId = single.RecordId ?? 0,
                    RecordName = Truncate(ResolveRecordName(single.Entry.Entity, employees)),
                    AffectedCount = 1,
                    Action = single.Action,
                    OldValues = Serialize(single.OldValues),
                    NewValues = Serialize(single.NewValues),
                    ChangedBy = changedBy,
                    ChangedAt = changedAt
                });
                continue;
            }

            var names = items.Select(i => ResolveRecordName(i.Entry.Entity, employees) ?? $"#{i.RecordId}").ToList();
            audits.Add(new AttendanceAuditTrail
            {
                TableName = group.Key.TableName,
                RecordId = items[0].RecordId ?? 0,
                RecordName = Truncate($"{names[0]} → {names[^1]} ({names.Count} bản ghi)"),
                AffectedCount = items.Count,
                Action = group.Key.Action,
                NewValues = JsonSerializer.Serialize(new
                {
                    AffectedCount = items.Count,
                    RecordIds = items.Take(MaxNamesInGroupedEntry).Select(i => i.RecordId).ToList(),
                    RecordNames = names.Take(MaxNamesInGroupedEntry).ToList(),
                    Truncated = items.Count > MaxNamesInGroupedEntry
                }, AuditJsonOptions),
                ChangedBy = changedBy,
                ChangedAt = changedAt
            });
        }

        return audits;
    }

    private static string? Serialize(Dictionary<string, object?>? values)
        => values is { Count: > 0 } ? JsonSerializer.Serialize(values, AuditJsonOptions) : null;

    private static string? Truncate(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Length > 255 ? value[..255] : value;

    private static string? ResolveRecordName(object entity, Dictionary<int, string> employees)
    {
        string Emp(int id) => employees.TryGetValue(id, out var label) ? label : $"NV #{id}";

        return entity switch
        {
            OtForm x => $"Đơn #{x.Id} - {x.Date:dd/MM/yyyy}",
            OtFormEmployee x => $"Đơn #{x.OtFormId} - {Emp(x.EmployeeId)}",
            ProcessPart x => $"Đơn #{x.OtFormId}",
            OtFormApprovalStep x => $"Đơn #{x.OtFormId} - bước {x.StepOrder}",
            OtFormBatch x => $"Đơn tổng #{x.Id} - {x.BatchDate:dd/MM/yyyy}",
            Employee x => $"{x.Code} - {x.LastName} {x.FirstName}",
            EmployeeAccumulationHistory x => $"{Emp(x.EmployeeId)} - {(x.Month == 0 ? "đầu kỳ" : $"T{x.Month}")}/{x.Year}",
            EmployeeApprovalScope x => $"{Emp(x.EmployeeId)} - Xưởng #{x.WorkshopId}, Phòng ban #{x.DepartmentId}",
            GroupBorrowedApprover x => $"Nhóm #{x.GroupId} - {Emp(x.EmployeeId)}",
            DepartmentApprovalStepCoordinator x => $"Phòng ban #{x.DepartmentId} - {Emp(x.EmployeeId)}",
            GroupApprovalStepCoordinator x => $"Nhóm #{x.GroupId} - {Emp(x.EmployeeId)}",
            ApprovalDelegation x => $"{Emp(x.DelegatorEmployeeId)} → {Emp(x.DelegateEmployeeId)}",
            Department x => $"{x.DepartmentCode} - {x.DepartmentNameVn}",
            Group x => $"{x.GroupCode} - {x.GroupNameVn}",
            Workshop x => $"{x.WorkshopCode} - {x.WorkshopNameVn}",
            Reason x => x.ReasonNameVn,
            OtCase x => x.Code,
            JobTitle x => $"{x.Code} - {x.Name}",
            JobTitlePermission x => $"Chức vụ #{x.JobTitleId} - {x.PermissionCode}",
            DepartmentApprovalStep x => $"Phòng ban #{x.DepartmentId} - bước {x.StepOrder}",
            GroupApprovalStep x => $"Nhóm #{x.GroupId} - bước {x.StepOrder}",
            ProductionApprovalStep x => $"Phòng ban #{x.DepartmentId} - bước {x.StepOrder}",
            ProductionLine x => x.LineCode,
            ProductionTeam x => x.Code,
            ProductionShiftTeam x => x.Code,
            WorkCalendarDay x => x.Date.ToString("dd/MM/yyyy"),
            UserSignature x => x.UserName,
            SecondaryPassword x => x.UserName,
            AttendanceSetting => "Cấu hình hệ thống",
            _ => null
        };
    }
}

using System.Text.Json;
using Asset.Domain.Entities;
using Asset.Domain.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.Extensions.Logging;
using Shared.Application.Helper;

namespace Asset.Infrastructure.Context;

// Automatically records an AuditTrail for every Create/Update/Delete that goes through AssetDbContext,
// intercepted at a single point (SaveChangesAsync) instead of manually editing each Service — any new
// entity added later is audited automatically, no need to remember to call anything extra (2026-07-16).
//
// 2026-07-23 revision:
//   - every row now carries RecordName (device code, IP address, prefix...) so the log tells WHICH
//     object was touched without joining back to the source table;
//   - entries of the same table + action inside one SaveChanges are collapsed into a single row with
//     AffectedCount (e.g. generating a /24 prefix = 1 row "192.168.1.1 -> 192.168.1.255 (255 records)"
//     instead of 255 rows).
public partial class AssetDbContext
{
    private readonly IHttpContextAccessor? _auditHttpContextAccessor;
    private readonly ILogger<AssetDbContext>? _auditLogger;

    // These tables are themselves logs/snapshots (already their own audit) — avoid nesting audit inside audit.
    private static readonly HashSet<Type> AuditExcludedTypes = new()
    {
        typeof(AuditTrail),
        typeof(DeviceConfigurationHistory),
        typeof(DeviceConfigurationInitial)
    };

    // A grouped row keeps at most this many record names in NewValues — enough to know what was
    // touched, without dumping a few hundred names into a single column.
    private const int MaxNamesInGroupedEntry = 50;

    public AssetDbContext(
        DbContextOptions<AssetDbContext> options,
        IHttpContextAccessor httpContextAccessor,
        ILogger<AssetDbContext> logger) : base(options)
    {
        _auditHttpContextAccessor = httpContextAccessor;
        _auditLogger = logger;
    }

    // Snapshot of a tracked change, captured BEFORE base.SaveChangesAsync (original values are gone
    // afterwards) and turned into the final AuditTrail rows only after the main data is persisted
    // (identity keys of Added rows are only known at that point).
    private sealed class PendingAudit
    {
        public required EntityEntry Entry { get; init; }
        public required string TableName { get; init; }
        public required string Action { get; init; }
        public required object Entity { get; init; }
        public int? RecordId { get; set; }
        public Dictionary<string, object?>? OldValues { get; init; }
        public Dictionary<string, object?>? NewValues { get; init; }
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ChangeTracker.DetectChanges();

        var pendings = new List<PendingAudit>();

        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State is EntityState.Unchanged or EntityState.Detached) continue;

            var entityType = entry.Entity.GetType();
            if (AuditExcludedTypes.Contains(entityType)) continue;

            switch (entry.State)
            {
                case EntityState.Added:
                    // RecordId stays null here — it is filled from the entry after the main save.
                    pendings.Add(new PendingAudit
                    {
                        Entry = entry,
                        TableName = entityType.Name,
                        Action = "Create",
                        Entity = entry.Entity,
                        NewValues = entry.Properties.ToDictionary(p => p.Metadata.Name, p => p.CurrentValue)
                    });
                    break;

                case EntityState.Modified:
                    var (oldValues, newValues) = DiffModifiedProperties(entry);
                    if (oldValues.Count == 0) break; // Update() was called but no field actually changed
                    pendings.Add(new PendingAudit
                    {
                        Entry = entry,
                        TableName = entityType.Name,
                        Action = DetectModifiedAction(entry),
                        Entity = entry.Entity,
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
                        Entity = entry.Entity,
                        RecordId = ReadPrimaryKey(entry, useOriginalValue: true),
                        OldValues = entry.Properties.ToDictionary(p => p.Metadata.Name, p => p.OriginalValue)
                    });
                    break;
            }
        }

        // Save the main business data first — Added entries only get their Id (identity) after this step.
        var result = await base.SaveChangesAsync(cancellationToken);

        if (pendings.Count == 0) return result;

        try
        {
            foreach (var pending in pendings.Where(p => p.RecordId is null))
            {
                pending.RecordId = ReadPrimaryKey(pending.Entry, useOriginalValue: false);
            }

            var deviceCodes = await LoadDeviceCodesAsync(pendings, cancellationToken);
            var audits = BuildAuditTrails(pendings, deviceCodes);

            if (audits.Count > 0)
            {
                AuditTrails.AddRange(audits);
                await base.SaveChangesAsync(cancellationToken);
            }
        }
        catch (Exception ex)
        {
            // Audit logging is best-effort: a logging failure must not lose the main business data
            // that was already saved successfully in the base.SaveChangesAsync step above.
            _auditLogger?.LogError(ex, "Ghi AuditTrail thất bại sau khi lưu dữ liệu chính.");
        }

        return result;
    }

    private static int? ReadPrimaryKey(EntityEntry entry, bool useOriginalValue)
    {
        // Entities with a composite key (e.g. DeviceSoftware: DeviceId+SoftwareId) only get 1 int
        // column represented in AuditTrail.RecordId -> take the first key column; the rest still
        // remains in Old/NewValues + RecordName so no information is lost.
        var pkProperty = entry.Metadata.FindPrimaryKey()?.Properties[0];
        if (pkProperty is null) return null;

        var property = entry.Property(pkProperty.Name);
        var value = useOriginalValue ? property.OriginalValue : property.CurrentValue;
        return value is null ? 0 : Convert.ToInt32(value);
    }

    private static (Dictionary<string, object?> oldValues, Dictionary<string, object?> newValues) DiffModifiedProperties(EntityEntry entry)
    {
        var oldValues = new Dictionary<string, object?>();
        var newValues = new Dictionary<string, object?>();

        foreach (var property in entry.Properties)
        {
            if (Equals(property.OriginalValue, property.CurrentValue)) continue;
            oldValues[property.Metadata.Name] = property.OriginalValue;
            newValues[property.Metadata.Name] = property.CurrentValue;
        }

        return (oldValues, newValues);
    }

    // Soft delete (IsDeleted false->true) and restore (true->false) both go through the Modified state
    // just like a regular Update — the correct Action must be inferred from the IsDeleted field
    // instead of just calling it "Update".
    private static string DetectModifiedAction(EntityEntry entry)
    {
        var isDeletedProperty = entry.Properties.FirstOrDefault(p => p.Metadata.Name == "IsDeleted");
        if (isDeletedProperty == null) return "Update";

        var wasDeleted = isDeletedProperty.OriginalValue is true;
        var isDeleted = isDeletedProperty.CurrentValue is true;

        if (!wasDeleted && isDeleted) return "Delete";
        if (wasDeleted && !isDeleted) return "Restore";
        return "Update";
    }

    // Child entities (DeviceConfiguration, DeviceEmail, DeviceSoftware, TransferHistory, IpAddress...)
    // only know a DeviceId — resolve it to the device code the user actually recognises, with a single
    // extra query per SaveChanges (and only when such an entity was touched).
    private async Task<Dictionary<int, string>> LoadDeviceCodesAsync(List<PendingAudit> pendings, CancellationToken cancellationToken)
    {
        var deviceIds = pendings
            .SelectMany(p => GetReferencedDeviceIds(p.Entity))
            .Distinct()
            .ToList();

        if (deviceIds.Count == 0) return new Dictionary<int, string>();

        return await Devices.AsNoTracking()
            .Where(d => deviceIds.Contains(d.Id))
            .Select(d => new { d.Id, d.DeviceCode })
            .ToDictionaryAsync(d => d.Id, d => d.DeviceCode, cancellationToken);
    }

    private static IEnumerable<int> GetReferencedDeviceIds(object entity)
    {
        switch (entity)
        {
            case DeviceConfiguration configuration:
                yield return configuration.DeviceId;
                break;
            case DeviceEmail email:
                yield return email.DeviceId;
                break;
            case DeviceSoftware software:
                yield return software.DeviceId;
                break;
            case IpAddress { DeviceId: not null } ipAddress:
                yield return ipAddress.DeviceId!.Value;
                break;
            case TransferHistory transfer:
                yield return transfer.OldDeviceId;
                yield return transfer.NewDeviceId;
                break;
        }
    }

    // Builds the final rows: entries sharing the same table + action inside one SaveChanges are
    // collapsed into a single summarised row.
    private List<AuditTrail> BuildAuditTrails(List<PendingAudit> pendings, Dictionary<int, string> deviceCodes)
    {
        var changedBy = _auditHttpContextAccessor?.HttpContext?.User?.Identity?.Name ?? "System";
        var changedAt = TimeHelper.GetCurrentUtcTime();
        var audits = new List<AuditTrail>();

        foreach (var group in pendings.GroupBy(p => new { p.TableName, p.Action }))
        {
            var items = group.ToList();

            if (items.Count == 1)
            {
                var single = items[0];
                audits.Add(new AuditTrail
                {
                    TableName = single.TableName,
                    RecordId = single.RecordId ?? 0,
                    RecordName = ResolveRecordName(single.Entity, deviceCodes),
                    AffectedCount = 1,
                    Action = single.Action,
                    OldValues = Serialize(single.OldValues),
                    NewValues = Serialize(single.NewValues),
                    ChangedBy = changedBy,
                    ChangedAt = changedAt
                });
                continue;
            }

            // Bulk operation: keep the list of affected names only — dumping every column of every
            // row is what used to flood the table (255 rows per IP prefix).
            var names = items
                .Select(item => ResolveRecordName(item.Entity, deviceCodes) ?? $"#{item.RecordId}")
                .ToList();

            audits.Add(new AuditTrail
            {
                TableName = group.Key.TableName,
                RecordId = items[0].RecordId ?? 0,
                RecordName = BuildGroupSummary(names),
                AffectedCount = items.Count,
                Action = group.Key.Action,
                OldValues = null,
                NewValues = JsonSerializer.Serialize(new
                {
                    AffectedCount = items.Count,
                    RecordIds = items.Take(MaxNamesInGroupedEntry).Select(i => i.RecordId).ToList(),
                    RecordNames = names.Take(MaxNamesInGroupedEntry).ToList(),
                    Truncated = items.Count > MaxNamesInGroupedEntry
                }),
                ChangedBy = changedBy,
                ChangedAt = changedAt
            });
        }

        return audits;
    }

    private static string BuildGroupSummary(List<string> names)
    {
        var summary = names.Count > 1
            ? $"{names[0]} → {names[^1]} ({names.Count} bản ghi)"
            : $"{names[0]} ({names.Count} bản ghi)";

        return summary.Length > 255 ? summary[..255] : summary;
    }

    private static string? Serialize(Dictionary<string, object?>? values)
        => values is { Count: > 0 } ? JsonSerializer.Serialize(values) : null;

    // Friendly label per entity so the log reads "PC-001 - Máy kế toán" instead of just "Device #12".
    private static string? ResolveRecordName(object entity, Dictionary<int, string> deviceCodes)
    {
        var name = entity switch
        {
            Device device => $"{device.DeviceCode} - {device.DeviceName}",
            IpAddress ipAddress => ipAddress.DeviceId.HasValue
                ? $"{ipAddress.IpAddress1} ({DeviceLabel(ipAddress.DeviceId.Value, deviceCodes)})"
                : ipAddress.IpAddress1,
            IpPrefix prefix => $"{prefix.Prefix}.x",
            Branch branch => $"{branch.BranchCode} - {branch.BranchName}",
            Supplier supplier => $"{supplier.SupplierCode} - {supplier.SupplierName}",
            DeviceType deviceType => $"{deviceType.TypeCode} - {deviceType.TypeName}",
            DeviceGroup deviceGroup => $"{deviceGroup.GroupCode} - {deviceGroup.GroupName}",
            DeviceDepartment department => $"{department.DepartmentCode} - {department.DepartmentName}",
            Software software => $"{software.SoftwareCode} - {software.SoftwareName}",
            SoftwareGroup softwareGroup => $"{softwareGroup.GroupCode} - {softwareGroup.GroupName}",
            DeviceConfiguration configuration => DeviceLabel(configuration.DeviceId, deviceCodes),
            DeviceEmail email => $"{email.Email} ({DeviceLabel(email.DeviceId, deviceCodes)})",
            DeviceSoftware deviceSoftware => $"{DeviceLabel(deviceSoftware.DeviceId, deviceCodes)} - Phần mềm #{deviceSoftware.SoftwareId}",
            TransferHistory transfer => $"{DeviceLabel(transfer.OldDeviceId, deviceCodes)} → {DeviceLabel(transfer.NewDeviceId, deviceCodes)}",
            AssetSetting => "Cấu hình hệ thống",
            _ => null
        };

        if (string.IsNullOrWhiteSpace(name)) return null;
        return name.Length > 255 ? name[..255] : name;
    }

    private static string DeviceLabel(int deviceId, Dictionary<int, string> deviceCodes)
        => deviceCodes.TryGetValue(deviceId, out var code) ? code : $"Thiết bị #{deviceId}";
}

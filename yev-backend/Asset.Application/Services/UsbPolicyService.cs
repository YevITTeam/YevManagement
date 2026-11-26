using System.Linq.Expressions;
using System.Security.Cryptography;
using System.Text;
using Asset.Application.Dtos.UsbLogs;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Asset.Domain.Enums;
using Microsoft.AspNetCore.Http;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    // USB write-block whitelist and agent sync (asset-module.md §1.24).
    public class UsbPolicyService : BaseService<IAssetUnitOfWork>, IUsbPolicyService
    {
        private const int StaleAgentHours = 24;
        private const int DefaultSyncSeconds = 60;
        private static readonly TimeSpan HeartbeatInterval = TimeSpan.FromMinutes(5);
        private static readonly TimeSpan SnapshotTtl = TimeSpan.FromSeconds(30);

        private const int PasswordIterations = 100_000;
        private const int MinPasswordLength = 6;

        private sealed record ApprovedList(List<string> Keys, List<string> ReadOnlyKeys, string Version);

        // PerMachine is keyed by both DeviceCode and computer name (DeviceName), mirroring how ingest matches a PC.
        private sealed record PolicySnapshot(
            UsbBlockMode Mode, HashSet<string> EnforceMachines, ApprovedList Global,
            Dictionary<string, ApprovedList> PerMachine, bool TrackCopyIn, string? PasswordHash,
            UsbAgentUpdateDto? Update, HashSet<string> UpdateMachines, int SyncSeconds, int? PurgeUninstalledDays, DateTime LoadedAt);

        // Every agent syncs about once a minute; a shared snapshot keeps that to one query per TTL (single IIS process).
        private static PolicySnapshot? _snapshot;

        // Auto-purge of uninstalled agents piggybacks on agent syncs instead of a background job.
        private static readonly TimeSpan PurgeEvery = TimeSpan.FromHours(1);
        private static DateTime _lastPurgeAt;

        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IAppReleaseFileStorage _fileStorage;

        public UsbPolicyService(IAssetUnitOfWork unitOfWork, IHttpContextAccessor httpContextAccessor, IAppReleaseFileStorage fileStorage)
            : base(unitOfWork)
        {
            _httpContextAccessor = httpContextAccessor;
            _fileStorage = fileStorage;
        }

        public async Task<UsbAgentSyncResponse> SyncAgentAsync(UsbAgentSyncRequest request)
        {
            var machineName = UsbLogService.NormalizeMachineName(request.MachineName);
            await TouchAgentAsync(machineName, Trunc(request.AgentVersion?.Trim(), 20), Trunc(request.WindowsUser?.Trim(), 150));

            var snapshot = await GetSnapshotAsync();
            if (snapshot.PurgeUninstalledDays is { } days && DateTime.UtcNow - _lastPurgeAt > PurgeEvery)
            {
                _lastPurgeAt = DateTime.UtcNow;
                await DeleteAgentsAsync(UninstalledBefore(Now().AddDays(-days)));
            }

            var deviceCode = ComputerNameParser.Parse(machineName) ?? "";
            var mode = snapshot.Mode;
            if (mode == UsbBlockMode.Enforce && snapshot.EnforceMachines.Count > 0
                && !snapshot.EnforceMachines.Contains(machineName)
                && !snapshot.EnforceMachines.Contains(deviceCode))
                mode = UsbBlockMode.Audit;

            var list = snapshot.PerMachine.GetValueOrDefault(deviceCode)
                ?? snapshot.PerMachine.GetValueOrDefault(machineName)
                ?? snapshot.Global;

            var current = request.PolicyVersion == list.Version;
            var update = snapshot.Update;
            var wantsUpdate = update != null && request.AgentVersion != update.Version
                && (snapshot.UpdateMachines.Count == 0 || snapshot.UpdateMachines.Contains(machineName) || snapshot.UpdateMachines.Contains(deviceCode));

            return new UsbAgentSyncResponse
            {
                Mode = (int)mode,
                PolicyVersion = list.Version,
                Approved = current ? null : list.Keys,
                ReadOnly = current ? null : list.ReadOnlyKeys,
                TrackCopyIn = snapshot.TrackCopyIn,
                UninstallPasswordHash = snapshot.PasswordHash,
                SyncSeconds = snapshot.SyncSeconds,
                Update = wantsUpdate ? update : null
            };
        }

        // Writes at most every HeartbeatInterval per PC unless the version or user changed.
        private async Task TouchAgentAsync(string machineName, string? version, string? windowsUser)
        {
            var now = DateTime.UtcNow.AddHours(7);
            var agent = await _unitOfWork.UsbAgents.FirstOrDefaultAsync(a => a.MachineName == machineName);
            if (agent != null && now - agent.LastSeenAt < HeartbeatInterval && agent.AgentVersion == version
                && (windowsUser == null || agent.WindowsUser == windowsUser))
                return;

            // Sessions opened before this agent went silent or was (re)installed can never get their unplug event
            // (a reinstall wipes the agent's session file); the agent's own sessions all start after the cutoff.
            var window = UsbLogService.AgentLiveWindow;
            var cutoff = agent == null ? now - window
                : now - agent.LastSeenAt >= window ? agent.LastSeenAt
                : agent.FirstSeenAt - window;
            foreach (var stale in await _unitOfWork.UsbSessions.FindAsync(
                         s => s.MachineName == machineName && s.DisconnectedAt == null && s.ConnectedAt < cutoff))
                stale.DisconnectedAt = cutoff;

            // Re-matched on every write so a PC added to (or renamed in) asset Devices later still gets linked.
            var deviceId = (await _unitOfWork.Devices.FirstOrDefaultAsync(UsbLogService.MatchesMachine(machineName)))?.Id;
            if (agent == null)
            {
                await _unitOfWork.UsbAgents.AddAsync(new UsbAgent
                {
                    MachineName = machineName,
                    AgentVersion = version,
                    WindowsUser = windowsUser,
                    FirstSeenAt = now,
                    LastSeenAt = now,
                    DeviceId = deviceId
                });
            }
            else
            {
                agent.AgentVersion = version;
                agent.WindowsUser = windowsUser ?? agent.WindowsUser;
                agent.LastSeenAt = now;
                agent.DeviceId = deviceId;
            }

            await _unitOfWork.SaveChangesAsync();
        }

        private async Task<PolicySnapshot> GetSnapshotAsync()
        {
            var cached = _snapshot;
            if (cached != null && DateTime.UtcNow - cached.LoadedAt < SnapshotTtl) return cached;

            var setting = (await _unitOfWork.AssetSettings.GetAllAsync()).FirstOrDefault();
            var global = (await _unitOfWork.UsbDevices.SelectAsync(
                    u => u.IsApproved && u.SerialNumber != "",
                    u => new { Key = u.VendorId + "|" + u.ProductId + "|" + u.SerialNumber, u.AccessLevel }))
                .Select(x => (x.Key, x.AccessLevel)).ToList();
            var perMachine = await _unitOfWork.UsbDeviceMachines.SelectAsync(
                m => !m.UsbDevice.IsApproved && m.UsbDevice.SerialNumber != "" && !m.Device.IsDeleted,
                m => new { m.Device.DeviceCode, m.Device.DeviceName, Key = m.UsbDevice.VendorId + "|" + m.UsbDevice.ProductId + "|" + m.UsbDevice.SerialNumber, m.UsbDevice.AccessLevel });

            var extras = new Dictionary<string, List<(string Key, int AccessLevel)>>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in perMachine)
                foreach (var name in new[] { row.DeviceCode, UsbLogService.NormalizeMachineName(row.DeviceName) })
                {
                    if (name.Length == 0) continue;
                    if (!extras.TryGetValue(name, out var keys)) extras[name] = keys = new List<(string, int)>();
                    keys.Add((row.Key, row.AccessLevel));
                }

            UsbAgentUpdateDto? update = null;
            if (!string.IsNullOrEmpty(setting?.UsbAgentTargetVersion))
            {
                var release = await _unitOfWork.UsbAgentReleases.FirstOrDefaultAsync(r => r.Version == setting.UsbAgentTargetVersion);
                if (release != null)
                    update = new UsbAgentUpdateDto { Version = release.Version, Sha256 = release.Sha256, Signature = release.Signature };
            }

            cached = new PolicySnapshot(
                (UsbBlockMode)(setting?.UsbBlockMode ?? 0),
                ParseMachines(setting?.UsbEnforceMachines),
                BuildList(global),
                extras.ToDictionary(e => e.Key, e => BuildList(global.Concat(e.Value)), StringComparer.OrdinalIgnoreCase),
                setting?.UsbTrackCopyIn ?? false,
                setting?.UsbUninstallPasswordHash,
                update,
                ParseMachines(setting?.UsbAgentUpdateMachines),
                setting?.UsbAgentSyncSeconds ?? DefaultSyncSeconds,
                setting?.UsbAgentPurgeUninstalledDays,
                DateTime.UtcNow);
            _snapshot = cached;
            return cached;
        }

        // A USB in the global list and a machine list has one level, so read-write wins only on a real conflict.
        private static ApprovedList BuildList(IEnumerable<(string Key, int AccessLevel)> items)
        {
            var all = items.Select(x => (Key: x.Key.ToUpperInvariant(), x.AccessLevel)).ToList();
            var readWrite = all.Where(x => x.AccessLevel != (int)UsbAccessLevel.ReadOnly).Select(x => x.Key)
                .Distinct().Order(StringComparer.Ordinal).ToList();
            var readOnly = all.Where(x => x.AccessLevel == (int)UsbAccessLevel.ReadOnly).Select(x => x.Key)
                .Except(readWrite).Distinct().Order(StringComparer.Ordinal).ToList();
            // Without read-only keys the text (and so the version) is what agents before 1.3 already hold.
            var text = string.Join('\n', readWrite) + (readOnly.Count == 0 ? "" : "\nR:" + string.Join('\n', readOnly));
            return new ApprovedList(readWrite, readOnly, Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)))[..16]);
        }

        private static HashSet<string> ParseMachines(string? value)
            => (value ?? "").Split(new[] { ',', ';', '\n', '\r', ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(UsbLogService.NormalizeMachineName)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

        public async Task<PagedResponse<UsbDeviceDto>> GetDevicesPagedAsync(UsbDeviceFilterRequest filter)
        {
            var query = DeviceQuery(filter);
            var sessions = _unitOfWork.UsbSessions.GetQueryable(false);
            var columns = UsbSort.Columns<UsbDevice>(
                ("name", u => u.Alias ?? u.FriendlyName),
                ("isApproved", u => u.IsApproved ? 2 : u.Machines.Any() ? 1 : 0),
                ("lastSeenAt", u => u.LastSeenAt),
                ("sessionCount", u => sessions.Count(s => s.UsbDeviceId == u.Id)));
            return await _unitOfWork.UsbDevices.ToPagedResponseAsync(
                UsbSort.Apply(query, filter.SortBy, filter.SortDesc, columns, q => q.OrderByDescending(u => u.LastSeenAt), u => u.Id),
                filter.PageIndex,
                filter.PageSize,
                ToDto(sessions));
        }

        public async Task<byte[]> ExportDevicesAsync(UsbDeviceFilterRequest filter)
        {
            var sessions = _unitOfWork.UsbSessions.GetQueryable(false);
            var rows = await _unitOfWork.UsbDevices.ToPagedResponseAsync(
                DeviceQuery(filter).OrderByDescending(u => u.LastSeenAt).ThenBy(u => u.Id), 1, UsbExcel.MaxRows, ToDto(sessions));

            return UsbExcel.Build("Thiết bị USB",
                new[] { "Tên gợi nhớ", "Tên thiết bị", "Loại", "VID", "PID", "Serial", "Serial chung", "Dung lượng (GB)", "Cấp phép", "Quyền",
                    "Xưởng", "Bộ phận", "Người cấp", "Ngày cấp", "Ghi chú", "Lần đầu", "Lần cuối", "Số lần cắm", "Máy cắm gần nhất" },
                rows.Data.Select(u => new object?[]
                {
                    u.Alias, u.FriendlyName, u.DeviceClass, u.VendorId, u.ProductId, u.SerialNumber, u.IsSharedSerial ? "Có" : null,
                    u.CapacityBytes == null ? null : Math.Round(u.CapacityBytes.Value / 1e9, 1),
                    u.IsApproved ? "Mọi máy" : u.ApprovedMachines.Count > 0 ? string.Join(", ", u.ApprovedMachines.Select(m => m.DeviceCode)) : "Chưa cấp",
                    u.IsApproved || u.ApprovedMachines.Count > 0 ? UsbExcel.AccessLevelText(u.AccessLevel) : null,
                    u.BranchName, u.DepartmentName, u.ApprovedBy, u.ApprovedAt, u.ApprovalNote, u.FirstSeenAt, u.LastSeenAt, u.SessionCount, u.LastMachineName
                }),
                rows.TotalCount);
        }

        private IQueryable<UsbDevice> DeviceQuery(UsbDeviceFilterRequest filter)
        {
            var query = _unitOfWork.UsbDevices.GetQueryable(false);

            if (!string.IsNullOrWhiteSpace(filter.Keyword))
            {
                var keyword = filter.Keyword.Trim();
                query = query.Where(u => u.SerialNumber.Contains(keyword)
                    || (u.FriendlyName != null && u.FriendlyName.Contains(keyword))
                    || (u.Alias != null && u.Alias.Contains(keyword))
                    || u.VendorId.Contains(keyword) || u.ProductId.Contains(keyword)
                    || (u.ApprovalNote != null && u.ApprovalNote.Contains(keyword)));
            }

            if (filter.IsApproved.HasValue)
                query = query.Where(u => (u.IsApproved || u.Machines.Any()) == filter.IsApproved.Value);

            if (!string.IsNullOrWhiteSpace(filter.DeviceClass))
                query = query.Where(u => u.DeviceClass == filter.DeviceClass);

            if (filter.BranchId.HasValue)
                query = query.Where(u => u.BranchId == filter.BranchId.Value);

            if (filter.DepartmentId.HasValue)
                query = query.Where(u => u.DepartmentId == filter.DepartmentId.Value);

            return query;
        }

        private static Expression<Func<UsbDevice, UsbDeviceDto>> ToDto(IQueryable<UsbSession> sessions)
            => u => new UsbDeviceDto
                {
                    Id = u.Id,
                    VendorId = u.VendorId,
                    ProductId = u.ProductId,
                    SerialNumber = u.SerialNumber,
                    FriendlyName = u.FriendlyName,
                    Alias = u.Alias,
                    CapacityBytes = u.CapacityBytes,
                    DeviceClass = u.DeviceClass,
                    IsApproved = u.IsApproved,
                    ApprovedBy = u.ApprovedBy,
                    ApprovedAt = u.ApprovedAt,
                    ApprovalNote = u.ApprovalNote,
                    AccessLevel = u.AccessLevel,
                    IsSharedSerial = u.IsSharedSerial,
                    BranchId = u.BranchId,
                    BranchName = u.Branch != null ? u.Branch.BranchName : null,
                    DepartmentId = u.DepartmentId,
                    DepartmentName = u.Department != null ? u.Department.DepartmentName : null,
                    FirstSeenAt = u.FirstSeenAt,
                    LastSeenAt = u.LastSeenAt,
                    SessionCount = sessions.Count(s => s.UsbDeviceId == u.Id),
                    LastMachineName = sessions.Where(s => s.UsbDeviceId == u.Id)
                        .OrderByDescending(s => s.ConnectedAt).Select(s => s.MachineName).FirstOrDefault(),
                    ApprovedMachines = u.Machines.OrderBy(m => m.Device.DeviceCode)
                        .Select(m => new UsbApprovedMachineDto { DeviceId = m.DeviceId, DeviceCode = m.Device.DeviceCode }).ToList()
                };

        public async Task ApproveAsync(int usbDeviceId, UsbApprovalRequest request)
        {
            var usb = await GetApprovableAsync(usbDeviceId);
            if (await _unitOfWork.Branches.FirstOrDefaultAsync(b => b.Id == request.BranchId && !b.IsDeleted) == null)
                throw new DomainException("Xưởng không còn tồn tại.");
            if (await _unitOfWork.DeviceDepartments.FirstOrDefaultAsync(d => d.Id == request.DepartmentId && !d.IsDeleted) == null)
                throw new DomainException("Bộ phận không còn tồn tại.");
            var existing = await _unitOfWork.UsbDeviceMachines.FindAsync(m => m.UsbDeviceId == usbDeviceId);

            if (request.AllMachines)
            {
                _unitOfWork.UsbDeviceMachines.RemoveRange(existing);
                usb.IsApproved = true;
            }
            else
            {
                var ids = request.DeviceIds.Distinct().ToList();
                if (ids.Count == 0) throw new DomainException("Chọn ít nhất 1 máy.");
                var found = await _unitOfWork.Devices.SelectAsync(d => ids.Contains(d.Id) && !d.IsDeleted, d => d.Id);
                if (found.Count != ids.Count) throw new DomainException("Có máy không còn trong Quản lý thiết bị.");

                _unitOfWork.UsbDeviceMachines.RemoveRange(existing.Where(m => !ids.Contains(m.DeviceId)));
                var have = existing.Select(m => m.DeviceId).ToHashSet();
                await _unitOfWork.UsbDeviceMachines.AddRangeAsync(ids.Where(id => !have.Contains(id)).Select(NewMachineApproval(usbDeviceId)));
                usb.IsApproved = false;
            }

            usb.AccessLevel = request.AccessLevel;
            usb.BranchId = request.BranchId;
            usb.DepartmentId = request.DepartmentId;
            usb.ApprovedBy = CurrentUser();
            usb.ApprovedAt = Now();
            usb.ApprovalNote = Trunc(request.Note?.Trim(), 255);
            _unitOfWork.UsbDevices.Update(usb);
            await _unitOfWork.SaveChangesAsync();
            _snapshot = null;
        }

        public async Task SetAliasAsync(int usbDeviceId, string? alias)
        {
            var usb = (await _unitOfWork.UsbDevices.GetByIdAsync(usbDeviceId)).OrThrowNotFound("Thiết bị USB", usbDeviceId);
            usb.Alias = Trunc(alias?.Trim(), 100);
            _unitOfWork.UsbDevices.Update(usb);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task RevokeAsync(int usbDeviceId)
        {
            var usb = (await _unitOfWork.UsbDevices.GetByIdAsync(usbDeviceId)).OrThrowNotFound("Thiết bị USB", usbDeviceId);
            _unitOfWork.UsbDeviceMachines.RemoveRange(await _unitOfWork.UsbDeviceMachines.FindAsync(m => m.UsbDeviceId == usbDeviceId));
            ClearApproval(usb);
            await _unitOfWork.SaveChangesAsync();
            _snapshot = null;
        }

        // Quick add/remove of one PC from the machine page; other machines' approvals are left alone.
        public async Task SetMachineApprovalAsync(int usbDeviceId, int deviceId, bool approve)
        {
            var usb = await GetApprovableAsync(usbDeviceId);
            if (usb.IsApproved) throw new DomainException("USB đang được cấp phép cho mọi máy.");

            var rows = await _unitOfWork.UsbDeviceMachines.FindAsync(m => m.UsbDeviceId == usbDeviceId);
            var row = rows.FirstOrDefault(m => m.DeviceId == deviceId);

            if (approve && row == null)
            {
                var device = (await _unitOfWork.Devices.FirstOrDefaultAsync(d => d.Id == deviceId && !d.IsDeleted)).OrThrowNotFound("Thiết bị", deviceId);
                // Quick approval has no owner picker: a USB without an owner takes the machine's workshop and department.
                usb.BranchId ??= device.BranchId;
                usb.DepartmentId ??= device.DepartmentId
                    ?? throw new DomainException("Máy chưa có bộ phận; cấp phép ở tab Thiết bị USB để chọn bộ phận.");
                await _unitOfWork.UsbDeviceMachines.AddAsync(NewMachineApproval(usbDeviceId)(deviceId));
                usb.ApprovedBy = CurrentUser();
                usb.ApprovedAt = Now();
                _unitOfWork.UsbDevices.Update(usb);
            }
            else if (!approve && row != null)
            {
                _unitOfWork.UsbDeviceMachines.Delete(row);
                if (rows.Count == 1) ClearApproval(usb);
            }
            else return;

            await _unitOfWork.SaveChangesAsync();
            _snapshot = null;
        }

        public async Task<UsbOwnerOptionsDto> GetOwnerOptionsAsync() => new()
        {
            Branches = (await _unitOfWork.Branches.SelectAsync(b => !b.IsDeleted, b => new UsbOwnerOptionDto { Id = b.Id, Name = b.BranchName }))
                .OrderBy(b => b.Name, StringComparer.CurrentCultureIgnoreCase).ToList(),
            Departments = (await _unitOfWork.DeviceDepartments.SelectAsync(d => !d.IsDeleted, d => new UsbOwnerOptionDto { Id = d.Id, Name = d.DepartmentName }))
                .OrderBy(d => d.Name, StringComparer.CurrentCultureIgnoreCase).ToList(),
        };

        public async Task<List<UsbMachineOptionDto>> GetMachineOptionsAsync()
        {
            var devices = await _unitOfWork.Devices.SelectAsync(
                d => !d.IsDeleted,
                d => new UsbMachineOptionDto { Id = d.Id, DeviceCode = d.DeviceCode, DeviceName = d.DeviceName });
            // Only PCs whose computer name an agent could report; printers, switches etc. never run one.
            return devices
                .Where(d => ComputerNameParser.Parse(d.DeviceName) != null || ComputerNameParser.Parse(d.DeviceCode) != null)
                .OrderBy(d => d.DeviceCode, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private async Task<UsbDevice> GetApprovableAsync(int usbDeviceId)
        {
            var usb = (await _unitOfWork.UsbDevices.GetByIdAsync(usbDeviceId)).OrThrowNotFound("Thiết bị USB", usbDeviceId);
            if (usb.DeviceClass != UsbDeviceClasses.DiskDrive)
                throw new DomainException("Chỉ cấp phép được thiết bị lưu trữ.");
            // Serial-less sticks share one identity per model, so approving one would approve them all.
            if (usb.SerialNumber.Length == 0)
                throw new DomainException("USB không có số serial nên không cấp phép riêng được.");
            return usb;
        }

        private void ClearApproval(UsbDevice usb)
        {
            usb.IsApproved = false;
            usb.ApprovedBy = null;
            usb.ApprovedAt = null;
            usb.ApprovalNote = null;
            usb.AccessLevel = (int)UsbAccessLevel.ReadWrite;
            _unitOfWork.UsbDevices.Update(usb);
        }

        private Func<int, UsbDeviceMachine> NewMachineApproval(int usbDeviceId)
        {
            var by = CurrentUser();
            var at = Now();
            return deviceId => new UsbDeviceMachine { UsbDeviceId = usbDeviceId, DeviceId = deviceId, ApprovedBy = by, ApprovedAt = at };
        }

        private string? CurrentUser() => Trunc(_httpContextAccessor.HttpContext?.User?.Identity?.Name, 150);

        private static DateTime Now() => DateTime.UtcNow.AddHours(7);

        public async Task<UsbPolicySettingDto> GetSettingAsync()
        {
            var setting = (await _unitOfWork.AssetSettings.GetAllAsync()).FirstOrDefault();
            return new UsbPolicySettingDto { Mode = setting?.UsbBlockMode ?? 0, EnforceMachines = setting?.UsbEnforceMachines };
        }

        public async Task<UsbPolicySettingDto> UpdateSettingAsync(UsbPolicySettingDto request)
        {
            var setting = (await _unitOfWork.AssetSettings.GetAllAsync()).FirstOrDefault()
                ?? throw new DomainException("Chưa có cấu hình Asset.");

            setting.UsbBlockMode = request.Mode;
            setting.UsbEnforceMachines = string.IsNullOrWhiteSpace(request.EnforceMachines) ? null : request.EnforceMachines.Trim();
            _unitOfWork.AssetSettings.Update(setting);
            await _unitOfWork.SaveChangesAsync();
            _snapshot = null;

            return new UsbPolicySettingDto { Mode = setting.UsbBlockMode, EnforceMachines = setting.UsbEnforceMachines };
        }

        public async Task<PagedResponse<UsbAgentDto>> GetAgentsPagedAsync(UsbAgentFilterRequest filter)
        {
            var staleBefore = DateTime.UtcNow.AddHours(7 - StaleAgentHours);
            var query = _unitOfWork.UsbAgents.GetQueryable(false);

            if (!string.IsNullOrWhiteSpace(filter.Keyword))
            {
                var keyword = filter.Keyword.Trim();
                query = query.Where(a => a.MachineName.Contains(keyword)
                    || (a.WindowsUser != null && a.WindowsUser.Contains(keyword))
                    || (a.AgentVersion != null && a.AgentVersion.Contains(keyword)));
            }

            if (filter.StaleOnly)
                query = query.Where(a => a.LastSeenAt < staleBefore);

            if (filter.BranchId.HasValue)
                query = query.Where(a => a.Device != null && a.Device.BranchId == filter.BranchId.Value);

            if (filter.DepartmentId.HasValue)
                query = query.Where(a => a.Device != null && a.Device.DepartmentId == filter.DepartmentId.Value);

            var events = _unitOfWork.UsbAgentEvents.GetQueryable(false);
            return await _unitOfWork.UsbAgents.ToPagedResponseAsync(
                UsbSort.Apply(query, filter.SortBy, filter.SortDesc, AgentColumns,
                    q => q.OrderBy(a => a.LastSeenAt < staleBefore ? 0 : 1).ThenBy(a => a.MachineName), a => a.Id),
                filter.PageIndex,
                filter.PageSize,
                a => new UsbAgentDto
                {
                    Id = a.Id,
                    MachineName = a.MachineName,
                    AgentVersion = a.AgentVersion,
                    WindowsUser = a.WindowsUser,
                    FirstSeenAt = a.FirstSeenAt,
                    LastSeenAt = a.LastSeenAt,
                    IsStale = a.LastSeenAt < staleBefore,
                    DeviceCode = a.Device != null ? a.Device.DeviceCode : null,
                    BranchName = a.Device != null ? a.Device.Branch.BranchName : null,
                    DepartmentName = a.Device != null && a.Device.DeviceDepartment != null ? a.Device.DeviceDepartment.DepartmentName : null,
                    LastEventType = events.Where(e => e.MachineName == a.MachineName)
                        .OrderByDescending(e => e.OccurredAt).Select(e => (int?)e.EventType).FirstOrDefault(),
                    LastEventAt = events.Where(e => e.MachineName == a.MachineName)
                        .OrderByDescending(e => e.OccurredAt).Select(e => (DateTime?)e.OccurredAt).FirstOrDefault()
                });
        }

        public async Task<List<UsbAgentEventDto>> GetAgentEventsAsync(string machineName)
        {
            var name = machineName.Trim();
            var rows = await _unitOfWork.UsbAgentEvents.ToPagedResponseAsync(
                _unitOfWork.UsbAgentEvents.GetQueryable(false).Where(e => e.MachineName == name)
                    .OrderByDescending(e => e.OccurredAt).ThenByDescending(e => e.Id),
                1, 100,
                e => new UsbAgentEventDto { EventType = e.EventType, OccurredAt = e.OccurredAt, Actor = e.Actor, Detail = e.Detail });
            return rows.Data.ToList();
        }

        // An agent that is still running comes back on its next sync; only the list row goes, its history stays.
        public async Task DeleteAgentAsync(int id)
        {
            var agent = (await _unitOfWork.UsbAgents.GetByIdAsync(id)).OrThrowNotFound("Agent", id);
            _unitOfWork.UsbAgents.Delete(agent);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<int> PurgeAgentsAsync(UsbAgentPurgeRequest request)
        {
            if (!request.Uninstalled && request.OfflineDays == null) throw new DomainException("Chọn loại máy cần xoá.");

            var count = request.Uninstalled ? await DeleteAgentsAsync(UninstalledBefore(DateTime.MaxValue)) : 0;
            if (request.OfflineDays is { } days)
            {
                var before = Now().AddDays(-days);
                count += await DeleteAgentsAsync(a => a.LastSeenAt < before);
            }
            return count;
        }

        // Uninstalled = the newest lifecycle event is Uninstalled; a reinstall logs Installed after it.
        private Expression<Func<UsbAgent, bool>> UninstalledBefore(DateTime before)
        {
            var events = _unitOfWork.UsbAgentEvents.GetQueryable(false);
            return a => events.Where(e => e.MachineName == a.MachineName)
                .OrderByDescending(e => e.OccurredAt).ThenByDescending(e => e.Id)
                .Select(e => e.EventType == (int)UsbAgentEventType.Uninstalled && e.OccurredAt < before)
                .FirstOrDefault();
        }

        private async Task<int> DeleteAgentsAsync(Expression<Func<UsbAgent, bool>> predicate)
        {
            var agents = await _unitOfWork.UsbAgents.FindAsync(predicate);
            if (agents.Count == 0) return 0;
            _unitOfWork.UsbAgents.RemoveRange(agents);
            await _unitOfWork.SaveChangesAsync();
            return agents.Count;
        }

        public async Task<UsbStatsDto> GetStatsAsync()
        {
            var now = Now();
            var today = now.Date;
            var liveAfter = now - UsbLogService.AgentLiveWindow;
            var staleBefore = now.AddHours(-StaleAgentHours);
            var agents = _unitOfWork.UsbAgents.GetQueryable(false);
            var sessions = _unitOfWork.UsbSessions.GetQueryable(false);
            var disks = _unitOfWork.UsbDevices.GetQueryable(false).Where(u => u.DeviceClass == UsbDeviceClasses.DiskDrive);
            // An open session on a silent PC may have been unplugged long ago, so only live agents count as "now".
            var liveNames = agents.Where(a => a.LastSeenAt >= liveAfter).Select(a => a.MachineName);
            var openNow = sessions.Where(s => s.DisconnectedAt == null && liveNames.Contains(s.MachineName));
            var todaySessions = sessions.Where(s => s.ConnectedAt >= today);
            var blocked = (int)UsbPolicyResult.Blocked;

            return new UsbStatsDto
            {
                AgentCount = await _unitOfWork.UsbAgents.CountAsync(agents),
                AgentOnlineCount = await _unitOfWork.UsbAgents.CountAsync(agents, a => a.LastSeenAt >= liveAfter),
                AgentStaleCount = await _unitOfWork.UsbAgents.CountAsync(agents, a => a.LastSeenAt < staleBefore),
                MachinesConnectedNow = (await _unitOfWork.UsbSessions.GroupCountAsync(openNow, s => s.MachineName, g => g.Key)).Count,
                BlockedNow = await _unitOfWork.UsbSessions.CountAsync(openNow, s => s.PolicyResult == blocked),
                SessionsToday = await _unitOfWork.UsbSessions.CountAsync(todaySessions),
                BlockedToday = await _unitOfWork.UsbSessions.CountAsync(todaySessions, s => s.PolicyResult == blocked),
                StorageUsbCount = await _unitOfWork.UsbDevices.CountAsync(disks),
                ApprovedUsbCount = await _unitOfWork.UsbDevices.CountAsync(disks, u => u.IsApproved || u.Machines.Any())
            };
        }

        public async Task<UsbAgentSettingDto> GetAgentSettingAsync()
        {
            var setting = (await _unitOfWork.AssetSettings.GetAllAsync()).FirstOrDefault();
            return new UsbAgentSettingDto
            {
                TrackCopyIn = setting?.UsbTrackCopyIn ?? false,
                HasUninstallPassword = setting?.UsbUninstallPasswordHash != null,
                TargetVersion = setting?.UsbAgentTargetVersion,
                UpdateMachines = setting?.UsbAgentUpdateMachines,
                SyncSeconds = setting?.UsbAgentSyncSeconds ?? DefaultSyncSeconds,
                PurgeUninstalledDays = setting?.UsbAgentPurgeUninstalledDays
            };
        }

        public async Task<UsbAgentSettingDto> UpdateAgentSettingAsync(UsbAgentSettingRequest request)
        {
            var setting = await GetAssetSettingAsync();
            var target = string.IsNullOrWhiteSpace(request.TargetVersion) ? null : request.TargetVersion.Trim();
            if (target != null && await _unitOfWork.UsbAgentReleases.FirstOrDefaultAsync(r => r.Version == target) == null)
                throw new DomainException($"Chưa có bản agent {target}.");

            setting.UsbTrackCopyIn = request.TrackCopyIn;
            setting.UsbAgentTargetVersion = target;
            setting.UsbAgentUpdateMachines = string.IsNullOrWhiteSpace(request.UpdateMachines) ? null : request.UpdateMachines.Trim();
            setting.UsbAgentSyncSeconds = request.SyncSeconds;
            setting.UsbAgentPurgeUninstalledDays = request.PurgeUninstalledDays;
            _lastPurgeAt = default;
            _unitOfWork.AssetSettings.Update(setting);
            await _unitOfWork.SaveChangesAsync();
            _snapshot = null;
            return await GetAgentSettingAsync();
        }

        public async Task SetUninstallPasswordAsync(string? password)
        {
            if (!string.IsNullOrEmpty(password) && password.Length < MinPasswordLength)
                throw new DomainException($"Mật khẩu tối thiểu {MinPasswordLength} ký tự.");

            var setting = await GetAssetSettingAsync();
            setting.UsbUninstallPasswordHash = string.IsNullOrEmpty(password) ? null : HashPassword(password);
            _unitOfWork.AssetSettings.Update(setting);
            await _unitOfWork.SaveChangesAsync();
            _snapshot = null;
        }

        // Format shared with YevUsbAgent Installer.VerifyPassword.
        public static string HashPassword(string password)
        {
            var salt = RandomNumberGenerator.GetBytes(16);
            var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, PasswordIterations, HashAlgorithmName.SHA256, 32);
            return $"{PasswordIterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
        }

        public async Task<List<UsbAgentReleaseDto>> GetReleasesAsync()
        {
            var releases = await _unitOfWork.UsbAgentReleases.GetAllAsync();
            return releases.OrderByDescending(r => r.UploadedAt).Select(ToReleaseDto).ToList();
        }

        public async Task<UsbAgentReleaseDto> UploadReleaseAsync(Stream content, string fileName, string signingKeyXml, string? note)
        {
            if (!string.Equals(Path.GetExtension(fileName), ".exe", StringComparison.OrdinalIgnoreCase))
                throw new DomainException("Chỉ nhận file YevUsbAgent.exe.");

            var storedFileName = await _fileStorage.SaveAsync(content, fileName);
            var path = _fileStorage.GetPhysicalPath(storedFileName);
            try
            {
                var bytes = await File.ReadAllBytesAsync(path);
                var signature = UsbAgentReleaseKey.Sign(bytes, signingKeyXml)
                    ?? throw new DomainException("Khoá ký trên server không khớp khoá của agent.");

                // The agent reports AssemblyName.Version in 3 parts; the exe's file version carries the same number.
                var fileVersion = System.Diagnostics.FileVersionInfo.GetVersionInfo(path).FileVersion;
                if (!Version.TryParse(fileVersion, out var parsed))
                    throw new DomainException("Không đọc được phiên bản của file exe.");
                var version = parsed.ToString(3);
                if (await _unitOfWork.UsbAgentReleases.FirstOrDefaultAsync(r => r.Version == version) != null)
                    throw new DomainException($"Bản {version} đã có.");

                var release = new UsbAgentRelease
                {
                    Version = version,
                    StoredFileName = storedFileName,
                    SizeBytes = bytes.LongLength,
                    Sha256 = Convert.ToHexString(SHA256.HashData(bytes)),
                    Signature = signature,
                    Note = Trunc(note?.Trim(), 255),
                    UploadedBy = CurrentUser(),
                    UploadedAt = Now()
                };
                await _unitOfWork.UsbAgentReleases.AddAsync(release);
                await _unitOfWork.SaveChangesAsync();
                return ToReleaseDto(release);
            }
            catch
            {
                File.Delete(path);
                throw;
            }
        }

        public async Task DeleteReleaseAsync(int id)
        {
            var release = (await _unitOfWork.UsbAgentReleases.GetByIdAsync(id)).OrThrowNotFound("Bản agent", id);
            var setting = (await _unitOfWork.AssetSettings.GetAllAsync()).FirstOrDefault();
            if (setting?.UsbAgentTargetVersion == release.Version)
                throw new DomainException("Bản này đang được phát cho agent, đổi bản phát hành trước khi xoá.");

            _unitOfWork.UsbAgentReleases.Delete(release);
            await _unitOfWork.SaveChangesAsync();
            File.Delete(_fileStorage.GetPhysicalPath(release.StoredFileName));
        }

        // Null when the version was never uploaded or its file is gone.
        public async Task<string?> GetReleaseFilePathAsync(string version)
        {
            var release = await _unitOfWork.UsbAgentReleases.FirstOrDefaultAsync(r => r.Version == version);
            if (release == null) return null;
            var path = _fileStorage.GetPhysicalPath(release.StoredFileName);
            return File.Exists(path) ? path : null;
        }

        private static UsbAgentReleaseDto ToReleaseDto(UsbAgentRelease r) => new()
        {
            Id = r.Id, Version = r.Version, SizeBytes = r.SizeBytes, Sha256 = r.Sha256,
            Note = r.Note, UploadedBy = r.UploadedBy, UploadedAt = r.UploadedAt
        };

        private async Task<AssetSetting> GetAssetSettingAsync()
            => (await _unitOfWork.AssetSettings.GetAllAsync()).FirstOrDefault() ?? throw new DomainException("Chưa có cấu hình Asset.");

        private static readonly Dictionary<string, Expression<Func<UsbAgent, object?>>> AgentColumns = UsbSort.Columns<UsbAgent>(
            ("machineName", a => a.MachineName),
            ("agentVersion", a => a.AgentVersion),
            ("windowsUser", a => a.WindowsUser),
            ("firstSeenAt", a => a.FirstSeenAt),
            ("lastSeenAt", a => a.LastSeenAt));

        private static string? Trunc(string? value, int max)
            => string.IsNullOrEmpty(value) ? null : (value.Length <= max ? value : value[..max]);
    }
}

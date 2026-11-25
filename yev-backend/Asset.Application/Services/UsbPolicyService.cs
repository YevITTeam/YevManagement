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
        private static readonly TimeSpan HeartbeatInterval = TimeSpan.FromMinutes(5);
        private static readonly TimeSpan SnapshotTtl = TimeSpan.FromSeconds(30);

        private sealed record ApprovedList(List<string> Keys, string Version);

        // PerMachine is keyed by both DeviceCode and computer name (DeviceName), mirroring how ingest matches a PC.
        private sealed record PolicySnapshot(
            UsbBlockMode Mode, HashSet<string> EnforceMachines, ApprovedList Global,
            Dictionary<string, ApprovedList> PerMachine, DateTime LoadedAt);

        // Every agent syncs about once a minute; a shared snapshot keeps that to one query per TTL (single IIS process).
        private static PolicySnapshot? _snapshot;

        private readonly IHttpContextAccessor _httpContextAccessor;

        public UsbPolicyService(IAssetUnitOfWork unitOfWork, IHttpContextAccessor httpContextAccessor) : base(unitOfWork)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<UsbAgentSyncResponse> SyncAgentAsync(UsbAgentSyncRequest request)
        {
            var machineName = UsbLogService.NormalizeMachineName(request.MachineName);
            await TouchAgentAsync(machineName, Trunc(request.AgentVersion?.Trim(), 20), Trunc(request.WindowsUser?.Trim(), 150));

            var snapshot = await GetSnapshotAsync();
            var deviceCode = ComputerNameParser.Parse(machineName) ?? "";
            var mode = snapshot.Mode;
            if (mode == UsbBlockMode.Enforce && snapshot.EnforceMachines.Count > 0
                && !snapshot.EnforceMachines.Contains(machineName)
                && !snapshot.EnforceMachines.Contains(deviceCode))
                mode = UsbBlockMode.Audit;

            var list = snapshot.PerMachine.GetValueOrDefault(deviceCode)
                ?? snapshot.PerMachine.GetValueOrDefault(machineName)
                ?? snapshot.Global;

            return new UsbAgentSyncResponse
            {
                Mode = (int)mode,
                PolicyVersion = list.Version,
                Approved = request.PolicyVersion == list.Version ? null : list.Keys
            };
        }

        // Writes at most every HeartbeatInterval per PC unless the version or user changed.
        private async Task TouchAgentAsync(string machineName, string? version, string? windowsUser)
        {
            var now = DateTime.UtcNow.AddHours(7);
            var agent = await _unitOfWork.UsbAgents.FirstOrDefaultAsync(a => a.MachineName == machineName);
            if (agent == null)
            {
                await _unitOfWork.UsbAgents.AddAsync(new UsbAgent
                {
                    MachineName = machineName,
                    AgentVersion = version,
                    WindowsUser = windowsUser,
                    FirstSeenAt = now,
                    LastSeenAt = now
                });
            }
            else if (now - agent.LastSeenAt >= HeartbeatInterval || agent.AgentVersion != version
                     || (windowsUser != null && agent.WindowsUser != windowsUser))
            {
                agent.AgentVersion = version;
                agent.WindowsUser = windowsUser ?? agent.WindowsUser;
                agent.LastSeenAt = now;
            }
            else return;

            await _unitOfWork.SaveChangesAsync();
        }

        private async Task<PolicySnapshot> GetSnapshotAsync()
        {
            var cached = _snapshot;
            if (cached != null && DateTime.UtcNow - cached.LoadedAt < SnapshotTtl) return cached;

            var setting = (await _unitOfWork.AssetSettings.GetAllAsync()).FirstOrDefault();
            var global = await _unitOfWork.UsbDevices.SelectAsync(
                u => u.IsApproved && u.SerialNumber != "",
                u => u.VendorId + "|" + u.ProductId + "|" + u.SerialNumber);
            var perMachine = await _unitOfWork.UsbDeviceMachines.SelectAsync(
                m => !m.UsbDevice.IsApproved && m.UsbDevice.SerialNumber != "" && !m.Device.IsDeleted,
                m => new { m.Device.DeviceCode, m.Device.DeviceName, Key = m.UsbDevice.VendorId + "|" + m.UsbDevice.ProductId + "|" + m.UsbDevice.SerialNumber });

            var extras = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in perMachine)
                foreach (var name in new[] { row.DeviceCode, UsbLogService.NormalizeMachineName(row.DeviceName) })
                {
                    if (name.Length == 0) continue;
                    if (!extras.TryGetValue(name, out var keys)) extras[name] = keys = new List<string>();
                    keys.Add(row.Key);
                }

            cached = new PolicySnapshot(
                (UsbBlockMode)(setting?.UsbBlockMode ?? 0),
                ParseMachines(setting?.UsbEnforceMachines),
                BuildList(global),
                extras.ToDictionary(e => e.Key, e => BuildList(global.Concat(e.Value)), StringComparer.OrdinalIgnoreCase),
                DateTime.UtcNow);
            _snapshot = cached;
            return cached;
        }

        private static ApprovedList BuildList(IEnumerable<string> keys)
        {
            var list = keys.Select(x => x.ToUpperInvariant()).Distinct().Order(StringComparer.Ordinal).ToList();
            return new ApprovedList(list, Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join('\n', list))))[..16]);
        }

        private static HashSet<string> ParseMachines(string? value)
            => (value ?? "").Split(new[] { ',', ';', '\n', '\r', ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(UsbLogService.NormalizeMachineName)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

        public async Task<PagedResponse<UsbDeviceDto>> GetDevicesPagedAsync(UsbDeviceFilterRequest filter)
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
                u => new UsbDeviceDto
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
                    FirstSeenAt = u.FirstSeenAt,
                    LastSeenAt = u.LastSeenAt,
                    SessionCount = sessions.Count(s => s.UsbDeviceId == u.Id),
                    LastMachineName = sessions.Where(s => s.UsbDeviceId == u.Id)
                        .OrderByDescending(s => s.ConnectedAt).Select(s => s.MachineName).FirstOrDefault(),
                    ApprovedMachines = u.Machines.OrderBy(m => m.Device.DeviceCode)
                        .Select(m => new UsbApprovedMachineDto { DeviceId = m.DeviceId, DeviceCode = m.Device.DeviceCode }).ToList()
                });
        }

        public async Task ApproveAsync(int usbDeviceId, UsbApprovalRequest request)
        {
            var usb = await GetApprovableAsync(usbDeviceId);
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
                (await _unitOfWork.Devices.FirstOrDefaultAsync(d => d.Id == deviceId && !d.IsDeleted)).OrThrowNotFound("Thiết bị", deviceId);
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
                    IsStale = a.LastSeenAt < staleBefore
                });
        }

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

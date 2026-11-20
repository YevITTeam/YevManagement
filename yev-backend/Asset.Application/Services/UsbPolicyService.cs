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

        private sealed record PolicySnapshot(
            UsbBlockMode Mode, HashSet<string> EnforceMachines, List<string> Approved, string Version, DateTime LoadedAt);

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
            var mode = snapshot.Mode;
            if (mode == UsbBlockMode.Enforce && snapshot.EnforceMachines.Count > 0
                && !snapshot.EnforceMachines.Contains(machineName)
                && !snapshot.EnforceMachines.Contains(ComputerNameParser.Parse(machineName) ?? ""))
                mode = UsbBlockMode.Audit;

            return new UsbAgentSyncResponse
            {
                Mode = (int)mode,
                PolicyVersion = snapshot.Version,
                Approved = request.PolicyVersion == snapshot.Version ? null : snapshot.Approved
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
            var approved = (await _unitOfWork.UsbDevices.SelectAsync(
                    u => u.IsApproved && u.SerialNumber != "",
                    u => u.VendorId + "|" + u.ProductId + "|" + u.SerialNumber))
                .Select(x => x.ToUpperInvariant())
                .Order(StringComparer.Ordinal)
                .ToList();
            var version = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join('\n', approved))))[..16];

            cached = new PolicySnapshot(
                (UsbBlockMode)(setting?.UsbBlockMode ?? 0),
                ParseMachines(setting?.UsbEnforceMachines),
                approved,
                version,
                DateTime.UtcNow);
            _snapshot = cached;
            return cached;
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
                    || u.VendorId.Contains(keyword) || u.ProductId.Contains(keyword)
                    || (u.ApprovalNote != null && u.ApprovalNote.Contains(keyword)));
            }

            if (filter.IsApproved.HasValue)
                query = query.Where(u => u.IsApproved == filter.IsApproved.Value);

            if (!string.IsNullOrWhiteSpace(filter.DeviceClass))
                query = query.Where(u => u.DeviceClass == filter.DeviceClass);

            var sessions = _unitOfWork.UsbSessions.GetQueryable(false);
            var columns = UsbSort.Columns<UsbDevice>(
                ("name", u => u.FriendlyName),
                ("isApproved", u => u.IsApproved),
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
                        .OrderByDescending(s => s.ConnectedAt).Select(s => s.MachineName).FirstOrDefault()
                });
        }

        public async Task SetApprovalAsync(int usbDeviceId, bool approve, string? note)
        {
            var usb = (await _unitOfWork.UsbDevices.GetByIdAsync(usbDeviceId)).OrThrowNotFound("Thiết bị USB", usbDeviceId);

            if (approve)
            {
                if (usb.DeviceClass != UsbDeviceClasses.DiskDrive)
                    throw new DomainException("Chỉ cấp phép được thiết bị lưu trữ.");
                // Serial-less sticks share one identity per model, so approving one would approve them all.
                if (usb.SerialNumber.Length == 0)
                    throw new DomainException("USB không có số serial nên không cấp phép riêng được.");

                usb.IsApproved = true;
                usb.ApprovedBy = Trunc(_httpContextAccessor.HttpContext?.User?.Identity?.Name, 150);
                usb.ApprovedAt = DateTime.UtcNow.AddHours(7);
                usb.ApprovalNote = Trunc(note?.Trim(), 255);
            }
            else
            {
                usb.IsApproved = false;
                usb.ApprovedBy = null;
                usb.ApprovedAt = null;
                usb.ApprovalNote = null;
            }

            _unitOfWork.UsbDevices.Update(usb);
            await _unitOfWork.SaveChangesAsync();
            _snapshot = null;
        }

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

using System.Linq.Expressions;
using Asset.Application.Dtos.UsbLogs;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Asset.Domain.Enums;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    public class UsbLogService : BaseService<IAssetUnitOfWork>, IUsbLogService
    {
        private const string DomainSuffix = ".yev.vn";
        private const int MaxEventsPerBatch = 1000;
        private const int MaxPathLength = 1000;

        // Heartbeat rows are written every 5 minutes; 15 minutes of silence means the PC is off or the agent is gone,
        // so its open sessions can no longer be trusted as "plugged in".
        private static readonly TimeSpan AgentLiveWindow = TimeSpan.FromMinutes(15);

        public UsbLogService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<UsbIngestResultDto> IngestAsync(UsbIngestRequest request)
        {
            if (request.Events.Count > MaxEventsPerBatch)
                throw new DomainException($"Mỗi lần gửi tối đa {MaxEventsPerBatch} sự kiện.");

            var machineName = NormalizeMachineName(request.MachineName);

            // The device code comes from the Computer Name naming rule, same as the Tanium import; names outside
            // the managed families fall back to DeviceName (old rows may still carry the ".yev.vn" suffix).
            var deviceCode = ComputerNameParser.Parse(machineName);
            var device = await _unitOfWork.Devices.FirstOrDefaultAsync(
                d => !d.IsDeleted && ((deviceCode != null && d.DeviceCode == deviceCode)
                    || d.DeviceName == machineName || d.DeviceName == machineName + DomainSuffix));

            var sessionIds = request.Events.Select(e => e.SessionId).Distinct().ToList();
            var sessions = (await _unitOfWork.UsbSessions.FindAsync(s => sessionIds.Contains(s.Id)))
                .ToDictionary(s => s.Id);

            var fileEventIds = request.Events.Where(e => e.Type == UsbEventTypes.File).Select(e => e.EventId).Distinct().ToList();
            var knownEventIds = (await _unitOfWork.UsbFileEvents.SelectAsync(e => fileEventIds.Contains(e.EventId), e => e.EventId))
                .ToHashSet();

            var usbDevices = new Dictionary<string, UsbDevice>();
            var processed = 0;
            var skipped = 0;

            foreach (var ev in request.Events)
            {
                var occurredAt = ev.OccurredAt.UtcDateTime.AddHours(7);
                var ok = false;

                switch (ev.Type)
                {
                    case UsbEventTypes.Connected:
                        ok = await ApplyConnectedAsync(ev, occurredAt, machineName, device, sessions, usbDevices);
                        break;
                    case UsbEventTypes.Disconnected:
                        if (sessions.TryGetValue(ev.SessionId, out var closing))
                        {
                            closing.DisconnectedAt ??= occurredAt;
                            ok = true;
                        }
                        break;
                    case UsbEventTypes.File:
                        ok = await ApplyFileAsync(ev, occurredAt, sessions, knownEventIds);
                        break;
                    case UsbEventTypes.Policy:
                        if (sessions.TryGetValue(ev.SessionId, out var reevaluated) && IsPolicyResult(ev.PolicyResult))
                        {
                            reevaluated.PolicyResult = ev.PolicyResult;
                            ok = true;
                        }
                        break;
                }

                if (ok) processed++; else skipped++;
            }

            await _unitOfWork.SaveChangesAsync();

            return new UsbIngestResultDto
            {
                ProcessedCount = processed,
                SkippedCount = skipped,
                DeviceMatched = device != null
            };
        }

        private async Task<bool> ApplyConnectedAsync(
            UsbIngestEvent ev, DateTime occurredAt, string machineName, Device? device,
            Dictionary<Guid, UsbSession> sessions, Dictionary<string, UsbDevice> usbDevices)
        {
            if (sessions.ContainsKey(ev.SessionId)) return true;
            if (string.IsNullOrWhiteSpace(ev.VendorId) || string.IsNullOrWhiteSpace(ev.ProductId)) return false;

            var vendorId = Trunc(ev.VendorId.Trim().ToUpperInvariant(), 8)!;
            var productId = Trunc(ev.ProductId.Trim().ToUpperInvariant(), 8)!;
            var serial = Trunc(ev.SerialNumber?.Trim(), 100) ?? "";
            var deviceClass = Trunc(ev.DeviceClass?.Trim(), 50) ?? UsbDeviceClasses.DiskDrive;
            var isDisk = deviceClass == UsbDeviceClasses.DiskDrive;

            var key = $"{vendorId}|{productId}|{serial}";
            if (!usbDevices.TryGetValue(key, out var usbDevice))
            {
                usbDevice = await _unitOfWork.UsbDevices.FirstOrDefaultAsync(
                    u => u.VendorId == vendorId && u.ProductId == productId && u.SerialNumber == serial);

                if (usbDevice == null)
                {
                    usbDevice = new UsbDevice
                    {
                        VendorId = vendorId,
                        ProductId = productId,
                        SerialNumber = serial,
                        DeviceClass = deviceClass,
                        FirstSeenAt = occurredAt
                    };
                    await _unitOfWork.UsbDevices.AddAsync(usbDevice);
                }
                usbDevices[key] = usbDevice;
            }

            usbDevice.FriendlyName = Trunc(ev.FriendlyName?.Trim(), 255) ?? usbDevice.FriendlyName;
            usbDevice.CapacityBytes = ev.CapacityBytes ?? usbDevice.CapacityBytes;
            if (occurredAt > usbDevice.LastSeenAt) usbDevice.LastSeenAt = occurredAt;

            // The PC is the source of truth for actual use: a PC without permission gets it switched on. Phones do not count.
            bool? wasPermitted = isDisk ? device?.IsUseUsb : null;
            if (isDisk && device != null && !device.IsUseUsb)
            {
                device.IsUseUsb = true;
                _unitOfWork.Devices.Update(device);
            }

            var session = new UsbSession
            {
                Id = ev.SessionId,
                MachineName = Trunc(machineName, 100)!,
                DeviceId = device?.Id,
                UsbDevice = usbDevice,
                WindowsUser = Trunc(ev.WindowsUser?.Trim(), 150),
                DriveLetter = Trunc(ev.DriveLetter?.Trim(), 10),
                VolumeLabel = Trunc(ev.VolumeLabel?.Trim(), 100),
                ConnectedAt = occurredAt,
                WasPermitted = wasPermitted,
                PolicyResult = IsPolicyResult(ev.PolicyResult) ? ev.PolicyResult : null
            };
            await _unitOfWork.UsbSessions.AddAsync(session);
            sessions[session.Id] = session;
            return true;
        }

        private async Task<bool> ApplyFileAsync(
            UsbIngestEvent ev, DateTime occurredAt, Dictionary<Guid, UsbSession> sessions, HashSet<Guid> knownEventIds)
        {
            if (ev.EventId == Guid.Empty || string.IsNullOrWhiteSpace(ev.FilePath)) return false;
            if (!Enum.IsDefined(typeof(UsbFileAction), ev.Action)) return false;
            if (!sessions.ContainsKey(ev.SessionId)) return false;

            // A resend of an already stored event is a success for the agent, so it drops it from its queue.
            if (!knownEventIds.Add(ev.EventId)) return true;

            await _unitOfWork.UsbFileEvents.AddAsync(new UsbFileEvent
            {
                EventId = ev.EventId,
                SessionId = ev.SessionId,
                Action = ev.Action,
                FilePath = Trunc(ev.FilePath.Trim(), MaxPathLength)!,
                OldFilePath = Trunc(ev.OldFilePath?.Trim(), MaxPathLength),
                SizeBytes = ev.SizeBytes,
                OccurredAt = occurredAt
            });
            return true;
        }

        public async Task<PagedResponse<UsbMachineDto>> GetMachinesPagedAsync(UsbMachineFilterRequest filter)
        {
            var query = _unitOfWork.UsbSessions.GetQueryable(false);

            if (!string.IsNullOrWhiteSpace(filter.Keyword))
            {
                var keyword = filter.Keyword.Trim();
                query = query.Where(s =>
                    s.MachineName.Contains(keyword)
                    || (s.WindowsUser != null && s.WindowsUser.Contains(keyword))
                    || (s.Device != null && s.Device.DeviceCode.Contains(keyword)));
            }

            if (filter.FromDate.HasValue)
                query = query.Where(s => s.ConnectedAt >= filter.FromDate.Value.Date);

            if (filter.ToDate.HasValue)
            {
                var toExclusive = filter.ToDate.Value.Date.AddDays(1);
                query = query.Where(s => s.ConnectedAt < toExclusive);
            }

            // One row per PC; the result is bounded by the number of PCs, so filtering/paging runs in memory.
            var groups = await _unitOfWork.UsbSessions.GroupCountAsync(
                query, s => s.MachineName,
                g => new UsbMachineDto
                {
                    MachineName = g.Key,
                    DeviceId = g.Max(s => s.DeviceId),
                    LastWindowsUser = g.Where(s => s.WindowsUser != null).OrderByDescending(s => s.ConnectedAt).Select(s => s.WindowsUser).FirstOrDefault(),
                    SessionCount = g.Count(),
                    UsbDeviceCount = g.Select(s => s.UsbDeviceId).Distinct().Count(),
                    FileEventCount = g.Sum(s => s.FileEvents.Count),
                    LastConnectedAt = g.Max(s => s.ConnectedAt),
                    IsConnectedNow = g.Any(s => s.DisconnectedAt == null),
                    UnpermittedCount = g.Count(s => s.WasPermitted == false),
                    // Only USBs blocked right now; past blocks stay visible per USB on the machine page.
                    BlockedCount = g.Count(s => s.PolicyResult == (int)UsbPolicyResult.Blocked && s.DisconnectedAt == null)
                });

            var live = await GetLiveMachinesAsync();
            foreach (var m in groups)
            {
                m.IsConnectedNow &= live.Contains(m.MachineName);
                if (!m.IsConnectedNow) m.BlockedCount = 0;
            }

            var machines = SortMachines(groups.Where(m => !filter.ConnectedNowOnly || m.IsConnectedNow), filter.SortBy, filter.SortDesc);

            var page = machines.Skip((filter.PageIndex - 1) * filter.PageSize).Take(filter.PageSize).ToList();

            var deviceIds = page.Where(m => m.DeviceId != null).Select(m => m.DeviceId!.Value).Distinct().ToList();
            var codes = (await _unitOfWork.Devices.SelectAsync(d => deviceIds.Contains(d.Id), d => new { d.Id, d.DeviceCode }))
                .ToDictionary(x => x.Id, x => x.DeviceCode);
            foreach (var machine in page)
                if (machine.DeviceId != null) machine.DeviceCode = codes.GetValueOrDefault(machine.DeviceId.Value);

            return new PagedResponse<UsbMachineDto>(page, machines.Count, filter.PageIndex, filter.PageSize);
        }

        public async Task<PagedResponse<UsbSessionDto>> GetSessionsPagedAsync(UsbSessionFilterRequest filter)
        {
            var query = _unitOfWork.UsbSessions.GetQueryable(false);

            if (filter.DeviceId.HasValue)
                query = query.Where(s => s.DeviceId == filter.DeviceId.Value);

            if (!string.IsNullOrWhiteSpace(filter.MachineName))
            {
                var machineName = filter.MachineName.Trim();
                query = query.Where(s => s.MachineName == machineName);
            }

            if (!string.IsNullOrWhiteSpace(filter.Keyword))
            {
                var keyword = filter.Keyword.Trim();
                query = query.Where(s =>
                    s.MachineName.Contains(keyword)
                    || (s.WindowsUser != null && s.WindowsUser.Contains(keyword))
                    || (s.Device != null && s.Device.DeviceCode.Contains(keyword))
                    || s.UsbDevice.SerialNumber.Contains(keyword)
                    || (s.UsbDevice.FriendlyName != null && s.UsbDevice.FriendlyName.Contains(keyword))
                    || (s.UsbDevice.Alias != null && s.UsbDevice.Alias.Contains(keyword)));
            }

            if (filter.FromDate.HasValue)
                query = query.Where(s => s.ConnectedAt >= filter.FromDate.Value.Date);

            if (filter.ToDate.HasValue)
            {
                var toExclusive = filter.ToDate.Value.Date.AddDays(1);
                query = query.Where(s => s.ConnectedAt < toExclusive);
            }

            if (filter.UnpermittedOnly)
                query = query.Where(s => s.WasPermitted == false);

            if (filter.PolicyResult.HasValue)
                query = query.Where(s => s.PolicyResult == filter.PolicyResult.Value);

            if (filter.UsbDeviceId.HasValue)
                query = query.Where(s => s.UsbDeviceId == filter.UsbDeviceId.Value);

            var live = (await GetLiveMachinesAsync()).ToList();

            return await _unitOfWork.UsbSessions.ToPagedResponseAsync(
                UsbSort.Apply(query, filter.SortBy, filter.SortDesc, SessionColumns, q => q.OrderByDescending(s => s.ConnectedAt), s => s.Id),
                filter.PageIndex,
                filter.PageSize,
                s => new UsbSessionDto
                {
                    Id = s.Id,
                    MachineName = s.MachineName,
                    DeviceId = s.DeviceId,
                    DeviceCode = s.Device != null ? s.Device.DeviceCode : null,
                    WindowsUser = s.WindowsUser,
                    VendorId = s.UsbDevice.VendorId,
                    ProductId = s.UsbDevice.ProductId,
                    SerialNumber = s.UsbDevice.SerialNumber,
                    FriendlyName = s.UsbDevice.FriendlyName,
                    UsbAlias = s.UsbDevice.Alias,
                    CapacityBytes = s.UsbDevice.CapacityBytes,
                    DriveLetter = s.DriveLetter,
                    VolumeLabel = s.VolumeLabel,
                    ConnectedAt = s.ConnectedAt,
                    DisconnectedAt = s.DisconnectedAt,
                    WasPermitted = s.WasPermitted,
                    PolicyResult = s.PolicyResult,
                    UsbDeviceId = s.UsbDeviceId,
                    DeviceClass = s.UsbDevice.DeviceClass,
                    IsApproved = s.UsbDevice.IsApproved,
                    AgentOnline = live.Contains(s.MachineName),
                    FileEventCount = s.FileEvents.Count
                });
        }

        public async Task<List<UsbMachineUsbDto>> GetMachineUsbsAsync(string machineName)
        {
            var name = machineName.Trim();
            var query = _unitOfWork.UsbSessions.GetQueryable(false).Where(s => s.MachineName == name);

            // Bounded by the USBs ever plugged into one PC, so no paging.
            var rows = await _unitOfWork.UsbSessions.GroupCountAsync(
                query, s => s.UsbDeviceId,
                g => new UsbMachineUsbDto
                {
                    UsbDeviceId = g.Key,
                    SessionCount = g.Count(),
                    FileEventCount = g.Sum(s => s.FileEvents.Count),
                    LastConnectedAt = g.Max(s => s.ConnectedAt),
                    IsConnectedNow = g.Any(s => s.DisconnectedAt == null),
                    LastPolicyResult = g.OrderByDescending(s => s.ConnectedAt).Select(s => s.PolicyResult).FirstOrDefault()
                });

            var agentLive = (await GetLiveMachinesAsync()).Contains(name);
            var ids = rows.Select(r => r.UsbDeviceId).ToList();
            var deviceId = (await _unitOfWork.UsbSessions.SelectAsync(s => s.MachineName == name && s.DeviceId != null, s => s.DeviceId)).Max();
            var approvedHere = deviceId == null ? new HashSet<int>()
                : (await _unitOfWork.UsbDeviceMachines.SelectAsync(m => m.DeviceId == deviceId && ids.Contains(m.UsbDeviceId), m => m.UsbDeviceId)).ToHashSet();
            var devices = (await _unitOfWork.UsbDevices.FindAsync(d => ids.Contains(d.Id))).ToDictionary(d => d.Id);
            var letters = await _unitOfWork.UsbSessions.GroupCountAsync(
                query.Where(s => s.DriveLetter != null), s => new { s.UsbDeviceId, s.DriveLetter }, g => g.Key);

            foreach (var row in rows)
            {
                var device = devices[row.UsbDeviceId];
                row.VendorId = device.VendorId;
                row.ProductId = device.ProductId;
                row.SerialNumber = device.SerialNumber;
                row.FriendlyName = device.FriendlyName;
                row.Alias = device.Alias;
                row.CapacityBytes = device.CapacityBytes;
                row.DeviceClass = device.DeviceClass;
                row.IsApproved = device.IsApproved;
                row.IsConnectedNow &= agentLive;
                row.ApprovedHere = approvedHere.Contains(row.UsbDeviceId);
                row.DriveLetters = letters.Where(l => l.UsbDeviceId == row.UsbDeviceId).Select(l => l.DriveLetter!).Order().ToList();
            }

            return rows.OrderByDescending(r => r.IsConnectedNow).ThenByDescending(r => r.LastConnectedAt).ToList();
        }

        public async Task<PagedResponse<UsbFileEventDto>> GetSessionFilesPagedAsync(
            Guid sessionId, int pageIndex, int pageSize, string? keyword, string? sortBy, bool sortDesc)
        {
            (await _unitOfWork.UsbSessions.GetByIdAsync(sessionId)).OrThrowNotFound("Phiên USB", sessionId);

            var query = _unitOfWork.UsbFileEvents.GetQueryable(false).Where(e => e.SessionId == sessionId);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var k = keyword.Trim();
                query = query.Where(e => e.FilePath.Contains(k) || (e.OldFilePath != null && e.OldFilePath.Contains(k)));
            }

            return await _unitOfWork.UsbFileEvents.ToPagedResponseAsync(
                UsbSort.Apply(query, sortBy, sortDesc, FileColumns, q => q.OrderBy(e => e.OccurredAt).ThenBy(e => e.Id), e => e.Id),
                pageIndex,
                pageSize,
                e => new UsbFileEventDto
                {
                    Id = e.Id,
                    Action = e.Action,
                    FilePath = e.FilePath,
                    OldFilePath = e.OldFilePath,
                    SizeBytes = e.SizeBytes,
                    OccurredAt = e.OccurredAt
                });
        }

        private static readonly Dictionary<string, Expression<Func<UsbSession, object?>>> SessionColumns = UsbSort.Columns<UsbSession>(
            ("connectedAt", s => s.ConnectedAt),
            ("disconnectedAt", s => s.DisconnectedAt),
            ("machineName", s => s.MachineName),
            ("windowsUser", s => s.WindowsUser),
            ("usb", s => s.UsbDevice.Alias ?? s.UsbDevice.FriendlyName),
            ("fileEventCount", s => s.FileEvents.Count));

        private static readonly Dictionary<string, Expression<Func<UsbFileEvent, object?>>> FileColumns = UsbSort.Columns<UsbFileEvent>(
            ("occurredAt", e => e.OccurredAt),
            ("action", e => e.Action),
            ("filePath", e => e.FilePath),
            ("sizeBytes", e => e.SizeBytes));

        // Machines are grouped and paged in memory, so they sort in memory too.
        private static List<UsbMachineDto> SortMachines(IEnumerable<UsbMachineDto> machines, string? sortBy, bool sortDesc)
        {
            Func<UsbMachineDto, object?>? key = sortBy?.ToLowerInvariant() switch
            {
                "machinename" => m => m.MachineName,
                "lastwindowsuser" => m => m.LastWindowsUser,
                "usbdevicecount" => m => m.UsbDeviceCount,
                "sessioncount" => m => m.SessionCount,
                "fileeventcount" => m => m.FileEventCount,
                "lastconnectedat" => m => m.LastConnectedAt,
                _ => null
            };
            if (key == null)
                return machines.OrderByDescending(m => m.IsConnectedNow).ThenByDescending(m => m.LastConnectedAt).ToList();

            var ordered = sortDesc ? machines.OrderByDescending(key) : machines.OrderBy(key);
            return ordered.ThenBy(m => m.MachineName).ToList();
        }

        private async Task<HashSet<string>> GetLiveMachinesAsync()
        {
            var cutoff = DateTime.UtcNow.AddHours(7) - AgentLiveWindow;
            var names = await _unitOfWork.UsbAgents.SelectAsync(a => a.LastSeenAt >= cutoff, a => a.MachineName);
            return names.ToHashSet(StringComparer.OrdinalIgnoreCase);
        }

        public static string NormalizeMachineName(string machineName)
        {
            var name = machineName.Trim();
            return name.EndsWith(DomainSuffix, StringComparison.OrdinalIgnoreCase) ? name[..^DomainSuffix.Length] : name;
        }

        private static bool IsPolicyResult(int? value) => value.HasValue && Enum.IsDefined(typeof(UsbPolicyResult), value.Value);

        private static string? Trunc(string? value, int max)
            => string.IsNullOrEmpty(value) ? null : (value.Length <= max ? value : value[..max]);
    }
}

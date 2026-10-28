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

        public UsbLogService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<UsbIngestResultDto> IngestAsync(UsbIngestRequest request)
        {
            if (request.Events.Count > MaxEventsPerBatch)
                throw new DomainException($"Mỗi lần gửi tối đa {MaxEventsPerBatch} sự kiện.");

            var machineName = request.MachineName.Trim();
            if (machineName.EndsWith(DomainSuffix, StringComparison.OrdinalIgnoreCase))
                machineName = machineName[..^DomainSuffix.Length];

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
                        FirstSeenAt = occurredAt
                    };
                    await _unitOfWork.UsbDevices.AddAsync(usbDevice);
                }
                usbDevices[key] = usbDevice;
            }

            usbDevice.FriendlyName = Trunc(ev.FriendlyName?.Trim(), 255) ?? usbDevice.FriendlyName;
            usbDevice.CapacityBytes = ev.CapacityBytes ?? usbDevice.CapacityBytes;
            if (occurredAt > usbDevice.LastSeenAt) usbDevice.LastSeenAt = occurredAt;

            // The PC is the source of truth for actual use: a PC without permission gets it switched on.
            bool? wasPermitted = device?.IsUseUsb;
            if (device != null && !device.IsUseUsb)
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
                WasPermitted = wasPermitted
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
                    UnpermittedCount = g.Count(s => s.WasPermitted == false)
                });

            var machines = groups.Where(m => !filter.ConnectedNowOnly || m.IsConnectedNow)
                .OrderByDescending(m => m.IsConnectedNow)
                .ThenByDescending(m => m.LastConnectedAt)
                .ToList();

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
                    || (s.UsbDevice.FriendlyName != null && s.UsbDevice.FriendlyName.Contains(keyword)));
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

            return await _unitOfWork.UsbSessions.ToPagedResponseAsync(
                query.OrderByDescending(s => s.ConnectedAt),
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
                    CapacityBytes = s.UsbDevice.CapacityBytes,
                    DriveLetter = s.DriveLetter,
                    VolumeLabel = s.VolumeLabel,
                    ConnectedAt = s.ConnectedAt,
                    DisconnectedAt = s.DisconnectedAt,
                    WasPermitted = s.WasPermitted,
                    FileEventCount = s.FileEvents.Count
                });
        }

        public async Task<PagedResponse<UsbFileEventDto>> GetSessionFilesPagedAsync(
            Guid sessionId, int pageIndex, int pageSize, string? keyword)
        {
            (await _unitOfWork.UsbSessions.GetByIdAsync(sessionId)).OrThrowNotFound("Phiên USB", sessionId);

            var query = _unitOfWork.UsbFileEvents.GetQueryable(false).Where(e => e.SessionId == sessionId);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var k = keyword.Trim();
                query = query.Where(e => e.FilePath.Contains(k) || (e.OldFilePath != null && e.OldFilePath.Contains(k)));
            }

            return await _unitOfWork.UsbFileEvents.ToPagedResponseAsync(
                query.OrderBy(e => e.OccurredAt).ThenBy(e => e.Id),
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

        private static string? Trunc(string? value, int max)
            => string.IsNullOrEmpty(value) ? null : (value.Length <= max ? value : value[..max]);
    }
}

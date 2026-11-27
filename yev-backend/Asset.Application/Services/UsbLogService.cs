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
        internal static readonly TimeSpan AgentLiveWindow = TimeSpan.FromMinutes(15);

        public UsbLogService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<UsbIngestResultDto> IngestAsync(UsbIngestRequest request)
        {
            if (request.Events.Count > MaxEventsPerBatch)
                throw new DomainException($"Mỗi lần gửi tối đa {MaxEventsPerBatch} sự kiện.");

            var machineName = NormalizeMachineName(request.MachineName);

            var device = await _unitOfWork.Devices.FirstOrDefaultAsync(MatchesMachine(machineName));

            var sessionIds = request.Events.Select(e => e.SessionId).Distinct().ToList();
            var sessions = (await _unitOfWork.UsbSessions.FindAsync(s => sessionIds.Contains(s.Id)))
                .ToDictionary(s => s.Id);

            var fileEventIds = request.Events.Where(e => e.Type == UsbEventTypes.File).Select(e => e.EventId).Distinct().ToList();
            var knownEventIds = (await _unitOfWork.UsbFileEvents.SelectAsync(e => fileEventIds.Contains(e.EventId), e => e.EventId))
                .ToHashSet();

            var agentEventIds = request.Events.Where(e => e.Type == UsbEventTypes.Agent).Select(e => e.EventId).Distinct().ToList();
            var knownAgentEventIds = (await _unitOfWork.UsbAgentEvents.SelectAsync(e => agentEventIds.Contains(e.EventId), e => e.EventId))
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
                    case UsbEventTypes.Agent:
                        ok = await ApplyAgentEventAsync(ev, occurredAt, machineName, knownAgentEventIds);
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
            if (ev.SharedSerial.HasValue) usbDevice.IsSharedSerial = ev.SharedSerial.Value;
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

            var filePath = Trunc(ev.FilePath.Trim(), MaxPathLength)!;
            await _unitOfWork.UsbFileEvents.AddAsync(new UsbFileEvent
            {
                EventId = ev.EventId,
                SessionId = ev.SessionId,
                Action = ev.Action,
                FilePath = filePath,
                OldFilePath = Trunc(ev.OldFilePath?.Trim(), MaxPathLength),
                SizeBytes = ev.SizeBytes,
                OccurredAt = occurredAt,
                IsSensitive = UsbFileActionExtensions.IsSensitiveFileEvent(ev.Action, filePath, ev.SizeBytes)
            });
            return true;
        }

        private async Task<bool> ApplyAgentEventAsync(UsbIngestEvent ev, DateTime occurredAt, string machineName, HashSet<Guid> knownIds)
        {
            if (ev.EventId == Guid.Empty || !Enum.IsDefined(typeof(UsbAgentEventType), ev.Action)) return false;
            if (!knownIds.Add(ev.EventId)) return true;

            await _unitOfWork.UsbAgentEvents.AddAsync(new UsbAgentEvent
            {
                EventId = ev.EventId,
                MachineName = Trunc(machineName, 100)!,
                EventType = ev.Action,
                OccurredAt = occurredAt,
                Actor = Trunc(ev.WindowsUser?.Trim(), 150),
                Detail = Trunc(ev.Detail?.Trim(), 255)
            });
            return true;
        }

        public async Task<PagedResponse<UsbMachineDto>> GetMachinesPagedAsync(UsbMachineFilterRequest filter)
        {
            var machines = await LoadMachinesAsync(filter);
            var page = machines.Skip((filter.PageIndex - 1) * filter.PageSize).Take(filter.PageSize).ToList();
            return new PagedResponse<UsbMachineDto>(page, machines.Count, filter.PageIndex, filter.PageSize);
        }

        public async Task<byte[]> ExportMachinesAsync(UsbMachineFilterRequest filter)
        {
            var machines = await LoadMachinesAsync(filter);

            return UsbExcel.Build("Máy tính USB",
                new[]
                {
                    "Máy", "Mã thiết bị", "Xưởng", "Bộ phận", "Người dùng", "Phiên bản agent", "Kết nối cuối", "Mất kết nối",
                    "Sự kiện agent gần nhất", "Lúc", "Số USB", "Lần cắm", "Thao tác file", "File cần chú ý", "Cắm USB gần nhất", "Đang cắm"
                },
                machines.Take(UsbExcel.MaxRows).Select(m => new object?[]
                {
                    m.MachineName, m.DeviceCode, m.BranchName, m.DepartmentName, m.LastWindowsUser, m.AgentVersion, m.AgentLastSeenAt,
                    m.IsStale ? "Có" : null, UsbExcel.AgentEventText(m.LastEventType), m.LastEventAt,
                    m.UsbDeviceCount, m.SessionCount, m.FileEventCount, m.SensitiveFileCount, m.LastConnectedAt, m.IsConnectedNow ? "Có" : null
                }),
                machines.Count);
        }

        // One row per PC: every agent row plus PCs that only have USB history. Bounded by the PC count, so the merge,
        // keyword match, sort and paging run in memory.
        private async Task<List<UsbMachineDto>> LoadMachinesAsync(UsbMachineFilterRequest filter)
        {
            var query = _unitOfWork.UsbSessions.GetQueryable(false);

            if (filter.FromDate.HasValue)
                query = query.Where(s => s.ConnectedAt >= filter.FromDate.Value.Date);

            if (filter.ToDate.HasValue)
            {
                var toExclusive = filter.ToDate.Value.Date.AddDays(1);
                query = query.Where(s => s.ConnectedAt < toExclusive);
            }

            query = FilterOwner(query, filter.BranchId, filter.DepartmentId);

            if (filter.SensitiveOnly)
                query = query.Where(s => s.FileEvents.Any(e => e.IsSensitive));

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
                    SensitiveFileCount = g.Sum(s => s.FileEvents.Count(e => e.IsSensitive)),
                    LastConnectedAt = g.Max(s => s.ConnectedAt),
                    IsConnectedNow = g.Any(s => s.DisconnectedAt == null),
                    UnpermittedCount = g.Count(s => s.WasPermitted == false),
                    // Only USBs blocked right now; past blocks stay visible per USB on the machine page.
                    BlockedCount = g.Count(s => s.PolicyResult == (int)UsbPolicyResult.Blocked && s.DisconnectedAt == null)
                });
            var byName = groups.ToDictionary(m => m.MachineName, StringComparer.OrdinalIgnoreCase);

            // A USB-only filter (dates, sensitive, plugged in) means "PCs with matching USB use", so agent-only PCs stay out.
            var usbFilter = filter.FromDate.HasValue || filter.ToDate.HasValue || filter.SensitiveOnly || filter.ConnectedNowOnly;
            var staleBefore = DateTime.UtcNow.AddHours(7 - UsbPolicyService.StaleAgentHours);
            var agentQuery = _unitOfWork.UsbAgents.GetQueryable(false);
            if (filter.BranchId.HasValue) agentQuery = agentQuery.Where(a => a.Device != null && a.Device.BranchId == filter.BranchId.Value);
            if (filter.DepartmentId.HasValue) agentQuery = agentQuery.Where(a => a.Device != null && a.Device.DepartmentId == filter.DepartmentId.Value);
            var agents = await _unitOfWork.UsbAgents.ToListAsync(agentQuery, a => new { a.Id, a.MachineName, a.AgentVersion, a.WindowsUser, a.FirstSeenAt, a.LastSeenAt, a.DeviceId });
            foreach (var agent in agents)
            {
                if (!byName.TryGetValue(agent.MachineName, out var machine))
                {
                    if (usbFilter) continue;
                    machine = new UsbMachineDto { MachineName = agent.MachineName };
                    byName[agent.MachineName] = machine;
                }
                machine.AgentId = agent.Id;
                machine.AgentVersion = agent.AgentVersion;
                machine.AgentFirstSeenAt = agent.FirstSeenAt;
                machine.AgentLastSeenAt = agent.LastSeenAt;
                machine.IsStale = agent.LastSeenAt < staleBefore;
                machine.DeviceId ??= agent.DeviceId;
                machine.LastWindowsUser ??= agent.WindowsUser;
            }

            var lastEvents = (await _unitOfWork.UsbAgentEvents.GroupCountAsync(
                    _unitOfWork.UsbAgentEvents.GetQueryable(false), e => e.MachineName,
                    g => new
                    {
                        MachineName = g.Key,
                        Type = g.OrderByDescending(e => e.OccurredAt).Select(e => (int?)e.EventType).FirstOrDefault(),
                        At = g.Max(e => (DateTime?)e.OccurredAt)
                    }))
                .ToDictionary(e => e.MachineName, StringComparer.OrdinalIgnoreCase);

            var live = await GetLiveMachinesAsync();
            foreach (var m in byName.Values)
            {
                m.IsConnectedNow &= live.Contains(m.MachineName);
                if (!m.IsConnectedNow) m.BlockedCount = 0;
                if (lastEvents.TryGetValue(m.MachineName, out var ev))
                {
                    m.LastEventType = ev.Type;
                    m.LastEventAt = ev.At;
                }
            }

            await FillOwnersAsync(byName.Values);

            IEnumerable<UsbMachineDto> rows = byName.Values;
            if (!string.IsNullOrWhiteSpace(filter.Keyword))
            {
                var keyword = filter.Keyword.Trim();
                bool Has(string? value) => value != null && value.Contains(keyword, StringComparison.OrdinalIgnoreCase);
                rows = rows.Where(m => Has(m.MachineName) || Has(m.DeviceCode) || Has(m.LastWindowsUser) || Has(m.AgentVersion));
            }
            if (filter.ConnectedNowOnly) rows = rows.Where(m => m.IsConnectedNow);
            if (filter.StaleOnly) rows = rows.Where(m => m.IsStale);

            return SortMachines(rows, filter.SortBy, filter.SortDesc);
        }

        private async Task FillOwnersAsync(IEnumerable<UsbMachineDto> machines)
        {
            var list = machines.ToList();
            var deviceIds = list.Where(m => m.DeviceId != null).Select(m => m.DeviceId!.Value).Distinct().ToList();
            var owners = (await _unitOfWork.Devices.SelectAsync(d => deviceIds.Contains(d.Id), d => new
                {
                    d.Id, d.DeviceCode, d.Branch.BranchName,
                    DepartmentName = d.DeviceDepartment != null ? d.DeviceDepartment.DepartmentName : null
                }))
                .ToDictionary(x => x.Id);
            foreach (var machine in list)
            {
                if (machine.DeviceId == null || !owners.TryGetValue(machine.DeviceId.Value, out var owner)) continue;
                machine.DeviceCode = owner.DeviceCode;
                machine.BranchName = owner.BranchName;
                machine.DepartmentName = owner.DepartmentName;
            }
        }

        public async Task<PagedResponse<UsbSessionDto>> GetSessionsPagedAsync(UsbSessionFilterRequest filter)
        {
            var live = (await GetLiveMachinesAsync()).ToList();

            return await _unitOfWork.UsbSessions.ToPagedResponseAsync(
                UsbSort.Apply(SessionQuery(filter), filter.SortBy, filter.SortDesc, SessionColumns, q => q.OrderByDescending(s => s.ConnectedAt), s => s.Id),
                filter.PageIndex,
                filter.PageSize,
                ToSessionDto(live));
        }

        public async Task<byte[]> ExportSessionsAsync(UsbSessionFilterRequest filter)
        {
            var rows = await _unitOfWork.UsbSessions.ToPagedResponseAsync(
                SessionQuery(filter).OrderByDescending(s => s.ConnectedAt).ThenBy(s => s.Id), 1, UsbExcel.MaxRows, ToSessionDto(new List<string>()));

            return UsbExcel.Build("Phiên cắm USB",
                new[] { "Giờ cắm", "Giờ rút", "Máy", "Mã thiết bị", "Người dùng", "USB", "Tên thiết bị", "Serial", "Ổ", "Nhãn ổ", "Kết quả", "Số thao tác file", "File cần chú ý" },
                rows.Data.Select(s => new object?[]
                {
                    s.ConnectedAt, s.DisconnectedAt, s.MachineName, s.DeviceCode, s.WindowsUser, s.UsbAlias ?? s.FriendlyName, s.FriendlyName,
                    s.SerialNumber, s.DriveLetter, s.VolumeLabel, UsbExcel.PolicyResultText(s.PolicyResult), s.FileEventCount, s.SensitiveFileCount
                }),
                rows.TotalCount);
        }

        public async Task<PagedResponse<UsbFileSearchDto>> SearchFilesPagedAsync(UsbFileFilterRequest filter)
            => await _unitOfWork.UsbFileEvents.ToPagedResponseAsync(
                UsbSort.Apply(FileQuery(filter), filter.SortBy, filter.SortDesc, FileSearchColumns, q => q.OrderByDescending(e => e.OccurredAt).ThenByDescending(e => e.Id), e => e.Id),
                filter.PageIndex,
                filter.PageSize,
                ToFileSearchDto);

        public async Task<byte[]> ExportFileEventsAsync(UsbFileFilterRequest filter)
        {
            var rows = await _unitOfWork.UsbFileEvents.ToPagedResponseAsync(
                FileQuery(filter).OrderByDescending(e => e.OccurredAt).ThenByDescending(e => e.Id), 1, UsbExcel.MaxRows, ToFileSearchDto);

            return UsbExcel.Build("Thao tác file USB",
                new[]
                {
                    "Thời gian", "Máy", "Mã thiết bị", "Xưởng", "Bộ phận", "Người dùng", "USB", "Serial", "Thao tác",
                    "Đường dẫn", "Đường dẫn cũ / nguồn trên USB", "Kích thước (byte)", "Cần chú ý"
                },
                rows.Data.Select(e => new object?[]
                {
                    e.OccurredAt, e.MachineName, e.DeviceCode, e.BranchName, e.DepartmentName, e.WindowsUser, e.UsbAlias ?? e.FriendlyName,
                    e.SerialNumber, e.ActionText, e.FilePath, e.OldFilePath, e.SizeBytes, e.IsSensitive ? "Có" : null
                }),
                rows.TotalCount);
        }

        // ponytail: LIKE '%keyword%' scans UsbFileEvents; add a full-text index on FilePath if the table reaches millions of rows.
        private IQueryable<UsbFileEvent> FileQuery(UsbFileFilterRequest filter)
        {
            var query = _unitOfWork.UsbFileEvents.GetQueryable(false);

            if (!string.IsNullOrWhiteSpace(filter.Keyword))
            {
                var keyword = filter.Keyword.Trim();
                query = query.Where(e => e.FilePath.Contains(keyword) || (e.OldFilePath != null && e.OldFilePath.Contains(keyword)));
            }

            if (!string.IsNullOrWhiteSpace(filter.Extension))
            {
                var extension = "." + filter.Extension.Trim().TrimStart('.');
                query = query.Where(e => e.FilePath.EndsWith(extension) || (e.OldFilePath != null && e.OldFilePath.EndsWith(extension)));
            }

            if (filter.FromDate.HasValue)
                query = query.Where(e => e.OccurredAt >= filter.FromDate.Value.Date);

            if (filter.ToDate.HasValue)
            {
                var toExclusive = filter.ToDate.Value.Date.AddDays(1);
                query = query.Where(e => e.OccurredAt < toExclusive);
            }

            query = filter.Direction?.ToLowerInvariant() switch
            {
                "out" => query.Where(e => e.Action == (int)UsbFileAction.Created || e.Action == (int)UsbFileAction.Modified || e.Action == (int)UsbFileAction.Renamed),
                "in" => query.Where(e => e.Action == (int)UsbFileAction.CopiedIn),
                "deleted" => query.Where(e => e.Action == (int)UsbFileAction.Deleted),
                _ => query
            };

            if (filter.SensitiveOnly)
                query = query.Where(e => e.IsSensitive);

            if (filter.BranchId.HasValue)
                query = query.Where(e => e.Session.Device != null && e.Session.Device.BranchId == filter.BranchId.Value);
            if (filter.DepartmentId.HasValue)
                query = query.Where(e => e.Session.Device != null && e.Session.Device.DepartmentId == filter.DepartmentId.Value);

            return query;
        }

        private static readonly Expression<Func<UsbFileEvent, UsbFileSearchDto>> ToFileSearchDto = e => new UsbFileSearchDto
        {
            Id = e.Id,
            Action = e.Action,
            FilePath = e.FilePath,
            OldFilePath = e.OldFilePath,
            SizeBytes = e.SizeBytes,
            OccurredAt = e.OccurredAt,
            IsSensitive = e.IsSensitive,
            SessionId = e.SessionId,
            MachineName = e.Session.MachineName,
            DeviceId = e.Session.DeviceId,
            DeviceCode = e.Session.Device != null ? e.Session.Device.DeviceCode : null,
            BranchName = e.Session.Device != null ? e.Session.Device.Branch.BranchName : null,
            DepartmentName = e.Session.Device != null && e.Session.Device.DeviceDepartment != null ? e.Session.Device.DeviceDepartment.DepartmentName : null,
            WindowsUser = e.Session.WindowsUser,
            UsbDeviceId = e.Session.UsbDeviceId,
            UsbAlias = e.Session.UsbDevice.Alias,
            FriendlyName = e.Session.UsbDevice.FriendlyName,
            SerialNumber = e.Session.UsbDevice.SerialNumber
        };

        private IQueryable<UsbSession> SessionQuery(UsbSessionFilterRequest filter)
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

            if (filter.SensitiveOnly)
                query = query.Where(s => s.FileEvents.Any(e => e.IsSensitive));

            if (filter.UsbDeviceId.HasValue)
                query = query.Where(s => s.UsbDeviceId == filter.UsbDeviceId.Value);

            query = FilterOwner(query, filter.BranchId, filter.DepartmentId);

            return query;
        }

        private static Expression<Func<UsbSession, UsbSessionDto>> ToSessionDto(List<string> liveMachines)
            => s => new UsbSessionDto
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
                    AgentOnline = liveMachines.Contains(s.MachineName),
                    FileEventCount = s.FileEvents.Count,
                    SensitiveFileCount = s.FileEvents.Count(e => e.IsSensitive)
                };

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
                    SensitiveFileCount = g.Sum(s => s.FileEvents.Count(e => e.IsSensitive)),
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
                row.AccessLevel = device.AccessLevel;
                row.IsSharedSerial = device.IsSharedSerial;
                row.IsConnectedNow &= agentLive;
                row.ApprovedHere = approvedHere.Contains(row.UsbDeviceId);
                row.DriveLetters = letters.Where(l => l.UsbDeviceId == row.UsbDeviceId).Select(l => l.DriveLetter!).Order().ToList();
            }

            return rows.OrderByDescending(r => r.IsConnectedNow).ThenByDescending(r => r.LastConnectedAt).ToList();
        }

        public async Task<PagedResponse<UsbFileEventDto>> GetSessionFilesPagedAsync(
            Guid sessionId, int pageIndex, int pageSize, string? keyword, string? sortBy, bool sortDesc, bool sensitiveOnly)
        {
            (await _unitOfWork.UsbSessions.GetByIdAsync(sessionId)).OrThrowNotFound("Phiên USB", sessionId);

            var query = _unitOfWork.UsbFileEvents.GetQueryable(false).Where(e => e.SessionId == sessionId);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var k = keyword.Trim();
                query = query.Where(e => e.FilePath.Contains(k) || (e.OldFilePath != null && e.OldFilePath.Contains(k)));
            }

            if (sensitiveOnly)
                query = query.Where(e => e.IsSensitive);

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
                    OccurredAt = e.OccurredAt,
                    IsSensitive = e.IsSensitive
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

        private static readonly Dictionary<string, Expression<Func<UsbFileEvent, object?>>> FileSearchColumns = UsbSort.Columns<UsbFileEvent>(
            ("occurredAt", e => e.OccurredAt),
            ("action", e => e.Action),
            ("filePath", e => e.FilePath),
            ("sizeBytes", e => e.SizeBytes),
            ("machineName", e => e.Session.MachineName),
            ("windowsUser", e => e.Session.WindowsUser));

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
                "agentversion" => m => m.AgentVersion,
                "agentlastseenat" => m => m.AgentLastSeenAt,
                _ => null
            };
            // Plugged in first, then most recent USB use; PCs that never used USB (null) sort last.
            if (key == null)
                return machines.OrderByDescending(m => m.IsConnectedNow).ThenByDescending(m => m.LastConnectedAt).ThenBy(m => m.MachineName).ToList();

            var ordered = sortDesc ? machines.OrderByDescending(key) : machines.OrderBy(key);
            return ordered.ThenBy(m => m.MachineName).ToList();
        }

        // Workshop/department of the PC as recorded in asset Devices; PCs matching no Device drop out.
        private static IQueryable<UsbSession> FilterOwner(IQueryable<UsbSession> query, int? branchId, int? departmentId)
        {
            if (branchId.HasValue) query = query.Where(s => s.Device != null && s.Device.BranchId == branchId.Value);
            if (departmentId.HasValue) query = query.Where(s => s.Device != null && s.Device.DepartmentId == departmentId.Value);
            return query;
        }

        private async Task<HashSet<string>> GetLiveMachinesAsync()
        {
            var cutoff = DateTime.UtcNow.AddHours(7) - AgentLiveWindow;
            var names = await _unitOfWork.UsbAgents.SelectAsync(a => a.LastSeenAt >= cutoff, a => a.MachineName);
            return names.ToHashSet(StringComparer.OrdinalIgnoreCase);
        }

        // The device code comes from the Computer Name naming rule, same as the Tanium import; names outside
        // the managed families fall back to DeviceName (old rows may still carry the ".yev.vn" suffix).
        internal static System.Linq.Expressions.Expression<Func<Device, bool>> MatchesMachine(string machineName)
        {
            var deviceCode = ComputerNameParser.Parse(machineName);
            return d => !d.IsDeleted && ((deviceCode != null && d.DeviceCode == deviceCode)
                || d.DeviceName == machineName || d.DeviceName == machineName + DomainSuffix);
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

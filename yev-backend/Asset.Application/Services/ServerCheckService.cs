using System.Collections.Concurrent;
using System.Net.NetworkInformation;
using Asset.Application.Dtos.ServerChecks;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Asset.Domain.Enums;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Http;
using Shared.Application.Helper;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    public class ServerCheckService : BaseService<IAssetUnitOfWork>, IServerCheckService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IServerCheckTemplateService _templateService;

        private const int PingCount = 10;
        private const int MinSuccessesForOk = 8;
        private const int PingTimeoutMs = 1000;
        // Pings to one IP are spaced 1s apart, like the Windows `ping` command. Back-to-back pings make Dell
        // iDRAC controllers rate-limit ICMP (only ~7/10 replies) and flip a healthy iDRAC to NG.
        private const int PingIntervalMs = 1000;
        private const int MaxParallelIps = 200;

        public ServerCheckService(IAssetUnitOfWork unitOfWork, IHttpContextAccessor httpContextAccessor, IServerCheckTemplateService templateService) : base(unitOfWork)
        {
            _httpContextAccessor = httpContextAccessor;
            _templateService = templateService;
        }

        public async Task<ServerCheckSessionDto?> GetTodaySessionAsync(int? branchId)
        {
            var effectiveBranchId = await ResolveViewBranchIdAsync(branchId);
            if (effectiveBranchId == null) return null;

            var today = TimeHelper.GetCurrentUtcTime().Date;
            var session = await _unitOfWork.ServerCheckSessions.FirstOrDefaultAsync(
                x => x.CheckDate == today && x.BranchId == effectiveBranchId && !x.IsDeleted);
            return session == null ? null : await BuildSessionDtoAsync(session);
        }

        public async Task<ServerCheckSessionDto> StartSessionAsync()
        {
            // Branch comes from the user's assignment, never from the client, so a wrong-branch scan is impossible.
            var branchId = await RequireAssignedBranchIdAsync();

            var today = TimeHelper.GetCurrentUtcTime().Date;
            var existing = await _unitOfWork.ServerCheckSessions.FirstOrDefaultAsync(
                x => x.CheckDate == today && x.BranchId == branchId && !x.IsDeleted);

            if (existing != null)
            {
                if (existing.Status == (int)ServerCheckSessionStatus.Completed)
                    throw new DomainException("Xưởng của bạn đã hoàn thành phiên kiểm tra hôm nay.");

                // Resume an InProgress session (e.g. the browser was closed mid-way) instead of creating a new one.
                return await BuildSessionDtoAsync(existing);
            }

            // Only RequiresDailyCheck devices (physically in the server room with a QR) are snapshotted; filtered by
            // category for report columns and by branch since each branch has its own session and sheet.
            var deviceRows = await _unitOfWork.Devices.SelectAsync(
                predicate: d => !d.IsDeleted && d.Status == (int)DeviceStatus.InUse
                    && d.DeviceType.ServerCheckCategory != null && d.RequiresDailyCheck && d.BranchId == branchId,
                selector: d => new { d.Id, Category = d.DeviceType.ServerCheckCategory!.Value }
            );

            var session = new ServerCheckSession
            {
                CheckDate = today,
                BranchId = branchId,
                StartedAt = TimeHelper.GetCurrentUtcTime(),
                StartedBy = GetCurrentUser(),
                Status = (int)ServerCheckSessionStatus.InProgress,
                IsDeleted = false
            };

            foreach (var device in deviceRows)
            {
                session.Items.Add(new ServerCheckItem
                {
                    DeviceId = device.Id,
                    Category = device.Category,
                    Status = (int)ServerCheckItemStatus.Pending
                });
            }

            await _unitOfWork.ServerCheckSessions.AddAsync(session);
            await _unitOfWork.SaveChangesAsync();

            return await BuildSessionDtoAsync(session);
        }

        public async Task<ServerCheckSessionDto> GetSessionByIdAsync(int id)
        {
            var session = (await _unitOfWork.ServerCheckSessions.GetByIdAsync(id)).OrThrowNotFound("Phiên kiểm tra", id);
            var visibleBranchId = await ResolveViewBranchIdAsync(null, enforceOnly: true);
            if (visibleBranchId != null && session.BranchId != visibleBranchId)
                throw new NotFoundException("Phiên kiểm tra", id);
            return await BuildSessionDtoAsync(session);
        }

        public async Task<ServerCheckItemDto> ScanAsync(int sessionId, ScanServerCheckItemDto request)
        {
            var session = (await _unitOfWork.ServerCheckSessions.GetByIdAsync(sessionId)).OrThrowNotFound("Phiên kiểm tra", sessionId);
            if (session.Status != (int)ServerCheckSessionStatus.InProgress)
                throw new DomainException("Phiên kiểm tra đã kết thúc, không thể quét thêm.");
            await EnsureOwnBranchSessionAsync(session);

            var deviceCode = request.DeviceCode.Trim();
            var device = await _unitOfWork.Devices.FirstOrDefaultAsync(d => d.DeviceCode == deviceCode && !d.IsDeleted);
            if (device == null) throw new DomainException($"Không tìm thấy thiết bị có mã '{deviceCode}'.");

            var item = await _unitOfWork.ServerCheckItems.FirstOrDefaultAsync(x => x.SessionId == sessionId && x.DeviceId == device.Id);
            if (item == null) throw new DomainException($"Thiết bị '{deviceCode}' không thuộc phạm vi kiểm tra hằng ngày hôm nay.");

            // Only iDRAC/SAN-type devices are scanned; the rest are pinged at session end, so scanning them is flagged as a mistake.
            var requiresScan = (await _unitOfWork.Devices.SelectAsync(
                predicate: d => d.Id == device.Id,
                selector: d => d.DeviceType.RequiresQrScan
            )).FirstOrDefault();
            if (!requiresScan)
                throw new DomainException($"Thiết bị '{deviceCode}' không cần quét QR — hệ thống tự ping khi kết thúc phiên.");

            // Rescanning an Ok device is idempotent; only the scan time is refreshed.
            item.ScannedAt = TimeHelper.GetCurrentUtcTime();
            item.ScannedBy = GetCurrentUser();
            item.Status = (int)ServerCheckItemStatus.Ok;
            item.Note = null;

            _unitOfWork.ServerCheckItems.Update(item);
            await _unitOfWork.SaveChangesAsync();

            return new ServerCheckItemDto
            {
                Id = item.Id,
                DeviceId = device.Id,
                DeviceCode = device.DeviceCode,
                DeviceName = device.DeviceName,
                Category = item.Category,
                CategoryText = item.Category.GetServerCheckCategoryText(),
                ScannedAt = item.ScannedAt,
                ScannedBy = item.ScannedBy,
                Status = item.Status,
                StatusText = item.Status.GetServerCheckItemStatusText(),
                Note = item.Note
            };
        }

        public async Task<ServerCheckSessionDto> EndSessionAsync(int sessionId, EndServerCheckSessionDto request)
        {
            var session = (await _unitOfWork.ServerCheckSessions.GetByIdAsync(sessionId)).OrThrowNotFound("Phiên kiểm tra", sessionId);
            if (session.Status != (int)ServerCheckSessionStatus.InProgress)
                throw new DomainException("Phiên kiểm tra đã kết thúc.");
            await EnsureOwnBranchSessionAsync(session);

            var activeManualItemIds = (await _unitOfWork.ServerCheckManualItems.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => x.Id
            )).ToHashSet();

            var providedManualIds = request.ManualResults.Select(x => x.ManualItemId).ToHashSet();
            if (!providedManualIds.IsSupersetOf(activeManualItemIds))
                throw new DomainException("Vui lòng xác nhận đủ toàn bộ mục kiểm tra thủ công.");

            foreach (var manual in request.ManualResults)
            {
                if (!activeManualItemIds.Contains(manual.ManualItemId)) continue;
                if (manual.Status != (int)ServerCheckItemStatus.Ok && manual.Status != (int)ServerCheckItemStatus.Ng)
                    throw new DomainException("Trạng thái mục kiểm tra thủ công không hợp lệ.");
            }

            var now = TimeHelper.GetCurrentUtcTime();
            var currentUser = GetCurrentUser();

            var pendingItems = await _unitOfWork.ServerCheckItems.FindAsync(
                x => x.SessionId == sessionId && x.Status == (int)ServerCheckItemStatus.Pending);

            var noteByItemId = request.Items.ToDictionary(x => x.ServerCheckItemId, x => x.Note);

            var scanRequiredByDeviceId = (await _unitOfWork.ServerCheckItems.SelectAsync(
                predicate: x => x.SessionId == sessionId,
                selector: x => new { x.DeviceId, x.Device.DeviceType.RequiresQrScan }
            )).ToDictionary(x => x.DeviceId, x => x.RequiresQrScan);

            // Scan-required devices still pending were not scanned → NG (with the free-text note).
            foreach (var item in pendingItems.Where(i => scanRequiredByDeviceId.GetValueOrDefault(i.DeviceId)))
            {
                item.Status = (int)ServerCheckItemStatus.Ng;
                item.Note = noteByItemId.TryGetValue(item.Id, out var note) ? note : null;
                _unitOfWork.ServerCheckItems.Update(item);
            }

            await ResolveAutoCheckItemsAsync(pendingItems.Where(i => !scanRequiredByDeviceId.GetValueOrDefault(i.DeviceId)).ToList());

            foreach (var manual in request.ManualResults.Where(x => activeManualItemIds.Contains(x.ManualItemId)))
            {
                await _unitOfWork.ServerCheckManualResults.AddAsync(new ServerCheckManualResult
                {
                    SessionId = sessionId,
                    ManualItemId = manual.ManualItemId,
                    Status = manual.Status,
                    Note = manual.Note,
                    ConfirmedBy = currentUser,
                    ConfirmedAt = now
                });
            }

            session.Status = (int)ServerCheckSessionStatus.Completed;
            session.EndedAt = now;
            session.EndedBy = currentUser;
            _unitOfWork.ServerCheckSessions.Update(session);

            await _unitOfWork.SaveChangesAsync();

            return await BuildSessionDtoAsync(session);
        }

        public async Task<List<ServerCheckManualItemDto>> GetManualItemsAsync()
        {
            var items = await _unitOfWork.ServerCheckManualItems.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new ServerCheckManualItemDto { Id = x.Id, Name = x.Name, DisplayOrder = x.DisplayOrder, UsesNetworkPing = x.UsesNetworkPing, IsAirConditioner = x.IsAirConditioner }
            );
            return items.OrderBy(x => x.DisplayOrder).ToList();
        }

        // Lets staff verify the network checklist items on the spot. Only IPs assigned to a Device are pinged,
        // in parallel with a short timeout so large subnets still finish in seconds.
        public async Task<NetworkPingResultDto> PingNetworkAsync()
        {
            // Includes QR-scanned devices (ping is informational). The scanner's assigned branch takes precedence;
            // AssetSetting.ServerCheckBranchId is only a fallback for unassigned accounts (e.g. Admin).
            var branchId = await GetAssignedBranchIdAsync();
            if (branchId == null)
            {
                var settings = await _unitOfWork.AssetSettings.GetAllAsync();
                branchId = settings.FirstOrDefault()?.ServerCheckBranchId;
            }

            var targets = await _unitOfWork.IpAddresses.SelectAsync(
                predicate: ip => !ip.IsDeleted && ip.DeviceId != null
                    && !ip.Device!.IsDeleted
                    && ip.Device.Status == (int)DeviceStatus.InUse
                    && ip.Device.DeviceType.ServerCheckCategory != null
                    && ip.Device.RequiresDailyCheck
                    && (branchId == null || ip.Device.BranchId == branchId),
                selector: ip => new PingTargetRow
                {
                    IpAddress = ip.IpAddress1,
                    DeviceId = ip.Device!.Id,
                    DeviceCode = ip.Device.DeviceCode,
                    DeviceName = ip.Device.DeviceName,
                    Category = ip.Device.DeviceType.ServerCheckCategory!.Value
                }
            );

            var items = await PingTargetsAsync(targets);
            return new NetworkPingResultDto
            {
                TotalCount = items.Count,
                ReachableCount = items.Count(r => r.Reachable),
                AllReachable = items.All(r => r.Reachable),
                Items = items
            };
        }

        // Turns the still-Pending items of devices that are NOT scanned by QR into OK/NG: ping every IP
        // assigned to the device (all must be reachable); a device with no IP can't be verified, so it is NG.
        private async Task ResolveAutoCheckItemsAsync(List<ServerCheckItem> autoItems)
        {
            if (autoItems.Count == 0) return;

            var deviceIds = autoItems.Select(i => i.DeviceId).ToList();
            var targets = await _unitOfWork.IpAddresses.SelectAsync(
                predicate: ip => !ip.IsDeleted && ip.DeviceId != null && deviceIds.Contains(ip.DeviceId.Value),
                selector: ip => new PingTargetRow
                {
                    IpAddress = ip.IpAddress1,
                    DeviceId = ip.Device!.Id,
                    DeviceCode = ip.Device.DeviceCode,
                    DeviceName = ip.Device.DeviceName,
                    Category = ip.Device.DeviceType.ServerCheckCategory ?? 0
                }
            );

            var pingByDevice = (await PingTargetsAsync(targets)).ToLookup(r => r.DeviceId);
            var now = TimeHelper.GetCurrentUtcTime();

            foreach (var item in autoItems)
            {
                var pings = pingByDevice[item.DeviceId].ToList();
                item.ScannedAt = now;

                if (pings.Count == 0)
                {
                    item.Status = (int)ServerCheckItemStatus.Ng;
                    item.Note = "Chưa có IP để ping";
                }
                else
                {
                    var failed = pings.Where(p => !p.Reachable).Select(p => p.IpAddress).ToList();
                    item.Status = (int)(failed.Count == 0 ? ServerCheckItemStatus.Ok : ServerCheckItemStatus.Ng);
                    item.Note = failed.Count == 0 ? null : $"Không ping được: {string.Join(", ", failed)}";
                }

                _unitOfWork.ServerCheckItems.Update(item);
            }
        }

        // Exactly PingCount pings per IP, run in parallel (capped) — shared by the preview endpoint and the
        // auto-resolve at session end.
        private static async Task<List<NetworkPingItemDto>> PingTargetsAsync(IEnumerable<PingTargetRow> targets)
        {
            var results = new ConcurrentBag<NetworkPingItemDto>();
            using var throttle = new SemaphoreSlim(MaxParallelIps);

            await Task.WhenAll(targets.Select(async target =>
            {
                await throttle.WaitAsync();
                try
                {
                    // Always PingCount pings (user prefers certainty over speed); OK when at least MinSuccessesForOk reply.
                    var successCount = 0;
                    var replyTimes = new List<long>();
                    for (var attempt = 0; attempt < PingCount; attempt++)
                    {
                        var attemptWatch = System.Diagnostics.Stopwatch.StartNew();
                        try
                        {
                            using var ping = new Ping();
                            var reply = await ping.SendPingAsync(target.IpAddress, PingTimeoutMs);
                            if (reply.Status == IPStatus.Success)
                            {
                                successCount++;
                                replyTimes.Add(reply.RoundtripTime);
                            }
                        }
                        catch (PingException)
                        {
                            // count as a failed ping
                        }

                        var remaining = PingIntervalMs - (int)attemptWatch.ElapsedMilliseconds;
                        if (attempt < PingCount - 1 && remaining > 0) await Task.Delay(remaining);
                    }
                    var reachable = successCount >= MinSuccessesForOk;
                    long? roundtripMs = replyTimes.Count > 0 ? (long)Math.Round(replyTimes.Average()) : null;

                    results.Add(new NetworkPingItemDto
                    {
                        IpAddress = target.IpAddress,
                        DeviceId = target.DeviceId,
                        DeviceCode = target.DeviceCode,
                        DeviceName = target.DeviceName,
                        Category = target.Category,
                        CategoryText = target.Category.GetServerCheckCategoryText(),
                        Reachable = reachable,
                        RoundtripMs = roundtripMs
                    });
                }
                finally
                {
                    throttle.Release();
                }
            }));

            return results.OrderBy(r => r.Category).ThenBy(r => r.DeviceCode).ToList();
        }

        public async Task<PagedResponse<ServerCheckSessionDto>> GetSessionsPagedAsync(int pageIndex, int pageSize, DateTime? fromDate, DateTime? toDate, int? branchId)
        {
            var effectiveBranchId = await ResolveViewBranchIdAsync(branchId);
            var query = _unitOfWork.ServerCheckSessions.GetQueryable(false).Where(x => !x.IsDeleted);
            if (effectiveBranchId != null) query = query.Where(x => x.BranchId == effectiveBranchId);

            if (fromDate.HasValue) query = query.Where(x => x.CheckDate >= fromDate.Value.Date);
            if (toDate.HasValue) query = query.Where(x => x.CheckDate <= toDate.Value.Date);

            return await _unitOfWork.ServerCheckSessions.ToPagedResponseAsync(
                query.OrderByDescending(x => x.CheckDate),
                pageIndex,
                pageSize,
                x => new ServerCheckSessionDto
                {
                    Id = x.Id,
                    CheckDate = x.CheckDate,
                    BranchId = x.BranchId,
                    BranchName = x.Branch != null ? x.Branch.BranchName : null,
                    StartedAt = x.StartedAt,
                    StartedBy = x.StartedBy,
                    EndedAt = x.EndedAt,
                    EndedBy = x.EndedBy,
                    Status = x.Status,
                    StatusText = x.Status == (int)ServerCheckSessionStatus.InProgress ? "Đang quét" : "Đã hoàn thành",
                    // Progress counts only devices that must be scanned; ping-verified ones resolve at session end.
                    TotalCount = x.Items.Count(i => i.Device.DeviceType.RequiresQrScan),
                    ScannedCount = x.Items.Count(i => i.Device.DeviceType.RequiresQrScan && i.Status == (int)ServerCheckItemStatus.Ok)
                }
            );
        }

        public async Task<List<ServerCheckReportRowDto>> GetReportAsync(DateTime fromDate, DateTime toDate, int? branchId)
        {
            var from = fromDate.Date;
            var to = toDate.Date;
            var effectiveBranchId = await ResolveViewBranchIdAsync(branchId);

            var sessions = await _unitOfWork.ServerCheckSessions.SelectAsync(
                predicate: x => !x.IsDeleted && x.CheckDate >= from && x.CheckDate <= to
                    && (effectiveBranchId == null || x.BranchId == effectiveBranchId),
                selector: x => new { x.Id, x.CheckDate, x.Status, x.EndedBy, x.BranchId, BranchName = x.Branch != null ? x.Branch.BranchName : null }
            );

            if (sessions.Count == 0) return new List<ServerCheckReportRowDto>();

            var sessionIds = sessions.Select(s => s.Id).ToList();

            var items = await _unitOfWork.ServerCheckItems.SelectAsync(
                predicate: x => sessionIds.Contains(x.SessionId),
                selector: x => new ReportItemRow
                {
                    SessionId = x.SessionId,
                    Category = x.Category,
                    Status = x.Status,
                    Note = x.Note,
                    DeviceCode = x.Device.DeviceCode
                }
            );

            var manualResults = await _unitOfWork.ServerCheckManualResults.SelectAsync(
                predicate: x => sessionIds.Contains(x.SessionId),
                selector: x => new { x.SessionId, x.ManualItemId, ManualItemName = x.ManualItem.Name, IsAirConditioner = x.ManualItem.IsAirConditioner, x.Status, x.Note, x.ConfirmedBy, x.ConfirmedAt }
            );

            // EndedBy stores only the username; full names live in the Identity DB, so use the ServerCheckAssignment snapshot.
            var fullNameByUserName = (await _unitOfWork.ServerCheckAssignments.SelectAsync(
                predicate: a => a.FullName != null,
                selector: a => new { a.UserName, a.FullName }
            )).GroupBy(a => a.UserName, StringComparer.OrdinalIgnoreCase)
              .ToDictionary(g => g.Key, g => g.First().FullName!, StringComparer.OrdinalIgnoreCase);

            var itemsBySession = items.ToLookup(x => x.SessionId);
            var manualBySession = manualResults.ToLookup(x => x.SessionId);

            (bool? status, string? note) Aggregate(int sessionStatus, List<ReportItemRow> sessionItems, ServerCheckCategory category)
            {
                // No final verdict for the day until the session is completed.
                if (sessionStatus != (int)ServerCheckSessionStatus.Completed) return (null, null);

                var group = sessionItems.Where(i => i.Category == (int)category).ToList();
                if (group.Count == 0) return (null, null);

                var ngItems = group.Where(i => i.Status == (int)ServerCheckItemStatus.Ng).ToList();
                if (ngItems.Count == 0) return (true, null);

                var note = string.Join("; ", ngItems.Select(i => i.DeviceCode));
                return (false, note);
            }

            return sessions.OrderBy(s => s.CheckDate).ThenBy(s => s.BranchName).Select(s =>
            {
                var sessionItems = itemsBySession[s.Id].ToList();

                var (serverStatus, serverNote) = Aggregate(s.Status, sessionItems, ServerCheckCategory.Server);
                var (networkStatus, networkNote) = Aggregate(s.Status, sessionItems, ServerCheckCategory.Network);
                var (upsStatus, upsNote) = Aggregate(s.Status, sessionItems, ServerCheckCategory.Ups);
                // The air conditioner is a manual tick (no device), kept out of ManualResults so generic manual columns stay unchanged.
                var acResult = manualBySession[s.Id].FirstOrDefault(m => m.IsAirConditioner);
                bool? acStatus = acResult == null ? null : acResult.Status == (int)ServerCheckItemStatus.Ok;
                var acNote = acResult != null && acStatus == false ? acResult.Note : null;

                return new ServerCheckReportRowDto
                {
                    CheckDate = s.CheckDate,
                    SessionId = s.Id,
                    BranchId = s.BranchId,
                    BranchName = s.BranchName,
                    SessionStatus = s.Status,
                    SessionStatusText = s.Status.GetServerCheckSessionStatusText(),
                    ServerStatus = serverStatus,
                    ServerNote = serverNote,
                    NetworkStatus = networkStatus,
                    NetworkNote = networkNote,
                    UpsStatus = upsStatus,
                    UpsNote = upsNote,
                    AirConditionerStatus = acStatus,
                    AirConditionerNote = acNote,
                    ManualResults = manualBySession[s.Id].Where(m => !m.IsAirConditioner).Select(m => new ServerCheckManualResultDto
                    {
                        ManualItemId = m.ManualItemId,
                        ManualItemName = m.ManualItemName,
                        Status = m.Status,
                        StatusText = m.Status.GetServerCheckItemStatusText(),
                        Note = m.Note,
                        ConfirmedBy = m.ConfirmedBy,
                        ConfirmedAt = m.ConfirmedAt
                    }).OrderBy(m => m.ManualItemId).ToList(),
                    CheckedBy = s.EndedBy != null && fullNameByUserName.TryGetValue(s.EndedBy, out var fullName) ? fullName : s.EndedBy
                };
            }).ToList();
        }

        // Fills the original paper template; its fixed columns map 1-1 to ServerCheckReportRowDto, so no dynamic header.
        public async Task<(byte[] Content, string FileName)> ExportReportAsync(DateTime fromDate, DateTime toDate, int? branchId)
        {
            var rows = await GetReportAsync(fromDate, toDate, branchId);
            // One entry per calendar day in the range; a day with no session keeps a null row so the
            // printed sheet shows every date and leaves the unchecked days blank.
            var rowsByDate = rows.ToLookup(r => r.CheckDate.Date);
            var displayRows = new List<(DateTime Date, ServerCheckReportRowDto? Row)>();
            for (var day = fromDate.Date; day <= toDate.Date; day = day.AddDays(1))
            {
                var dayRows = rowsByDate[day].ToList();
                if (dayRows.Count == 0) displayRows.Add((day, null));
                else displayRows.AddRange(dayRows.Select(r => (day, (ServerCheckReportRowDto?)r)));
            }

            // Columns F..L are pre-printed in DisplayOrder 1..7; map by that order, not by ManualItemId (DB ids differ per environment).
            var manualItemIdsInOrder = (await GetManualItemsAsync()).Where(x => !x.IsAirConditioner).Select(x => x.Id).ToList();

            using var workbook = new XLWorkbook(new MemoryStream(_templateService.GetCheckSheetTemplateBytes()));
            var sheet = workbook.Worksheet("Sheet1");

            const int templateFirstDataRow = 9;
            const int templateLastDataRow = 34; // 26 empty rows pre-made in the template
            const int templateRowCount = templateLastDataRow - templateFirstDataRow + 1;

            if (displayRows.Count < templateRowCount)
            {
                // Drop unused rows (the footer/signature block moves up) so short ranges don't print blank rows.
                sheet.Rows(templateFirstDataRow + displayRows.Count, templateLastDataRow).Delete();
            }
            else if (displayRows.Count > templateRowCount)
            {
                var extraRows = displayRows.Count - templateRowCount;
                var templateRow = sheet.Row(templateLastDataRow);
                var inserted = templateRow.InsertRowsBelow(extraRows);
                foreach (var newRow in inserted)
                    templateRow.CopyTo(newRow);
            }

            // The month/year header has a single cell, so fill it only when the range fits in one month.
            var singleMonth = fromDate.Year == toDate.Year && fromDate.Month == toDate.Month;
            // Fill the branch cell (N2) only when the report covers exactly one branch.
            var branchNames = rows.Select(r => r.BranchName).Where(n => !string.IsNullOrEmpty(n)).Distinct().ToList();
            if (branchNames.Count == 1) sheet.Cell("N2").Value = branchNames[0];

            if (singleMonth)
            {
                sheet.Cell("N3").Value = fromDate.Month;
                sheet.Cell("N4").Value = fromDate.Year;
            }

            static string StatusText(bool? status) => status switch
            {
                true => "OK",
                false => "NG",
                null => string.Empty
            };

            for (var i = 0; i < displayRows.Count; i++)
            {
                var (date, row) = displayRows[i];
                var excelRow = templateFirstDataRow + i;

                sheet.Cell(excelRow, 1).Value = singleMonth ? date.Day.ToString() : date.ToString("dd/MM/yyyy");
                if (row == null) continue;

                sheet.Cell(excelRow, 2).Value = StatusText(row.ServerStatus);
                sheet.Cell(excelRow, 3).Value = StatusText(row.NetworkStatus);
                sheet.Cell(excelRow, 4).Value = StatusText(row.UpsStatus);
                sheet.Cell(excelRow, 5).Value = StatusText(row.AirConditionerStatus);

                // ManualResults exist only after EndSessionAsync; InProgress sessions leave these cells blank.
                var manualByItemId = row.ManualResults.ToDictionary(m => m.ManualItemId);
                for (var col = 0; col < manualItemIdsInOrder.Count && col < 7; col++)
                {
                    if (manualByItemId.TryGetValue(manualItemIdsInOrder[col], out var manual))
                        sheet.Cell(excelRow, 6 + col).Value = StatusText(manual.Status == (int)ServerCheckItemStatus.Ok);
                }

                sheet.Cell(excelRow, 13).Value = row.CheckedBy ?? string.Empty;

                var noteParts = new List<string>();
                if (row.ServerStatus == false) noteParts.Add($"Đèn báo Server: {row.ServerNote}");
                if (row.NetworkStatus == false) noteParts.Add($"Đèn báo Network: {row.NetworkNote}");
                if (row.UpsStatus == false) noteParts.Add($"Đèn báo UPS: {row.UpsNote}");
                if (row.AirConditionerStatus == false) noteParts.Add($"Máy lạnh: {row.AirConditionerNote}");
                noteParts.AddRange(row.ManualResults
                    .Where(m => m.Status == (int)ServerCheckItemStatus.Ng)
                    .Select(m => string.IsNullOrWhiteSpace(m.Note) ? m.ManualItemName : $"{m.ManualItemName}: {m.Note}"));
                sheet.Cell(excelRow, 14).Value = string.Join("; ", noteParts);
            }

            using var output = new MemoryStream();
            workbook.SaveAs(output);

            var branchSuffix = branchNames.Count == 1 ? $"_{branchNames[0]}" : string.Empty;
            var fileName = fromDate.Date == toDate.Date
                ? $"CheckSheet_KiemTraServer{branchSuffix}_{fromDate:yyyyMMdd}.xlsx"
                : $"CheckSheet_KiemTraServer{branchSuffix}_{fromDate:yyyyMMdd}-{toDate:yyyyMMdd}.xlsx";
            return (output.ToArray(), fileName);
        }

        private async Task<ServerCheckSessionDto> BuildSessionDtoAsync(ServerCheckSession session)
        {
            var items = await _unitOfWork.ServerCheckItems.SelectAsync(
                predicate: x => x.SessionId == session.Id,
                selector: x => new ServerCheckItemDto
                {
                    Id = x.Id,
                    DeviceId = x.DeviceId,
                    DeviceCode = x.Device.DeviceCode,
                    DeviceName = x.Device.DeviceName,
                    Category = x.Category,
                    // Inline ternary: EF translates this expression to SQL and can't call an extension method.
                    CategoryText = x.Category == (int)ServerCheckCategory.Server ? "Server"
                        : x.Category == (int)ServerCheckCategory.Network ? "Network"
                        : x.Category == (int)ServerCheckCategory.Ups ? "UPS"
                        : "Không xác định",
                    ScannedAt = x.ScannedAt,
                    ScannedBy = x.ScannedBy,
                    Status = x.Status,
                    StatusText = x.Status == (int)ServerCheckItemStatus.Pending ? "Chưa quét"
                        : x.Status == (int)ServerCheckItemStatus.Ok ? "OK"
                        : x.Status == (int)ServerCheckItemStatus.Ng ? "NG"
                        : "Không xác định",
                    Note = x.Note,
                    RequiresScan = x.Device.DeviceType.RequiresQrScan
                }
            );

            var manualResults = await BuildManualResultsAsync(session.Id);

            string? branchName = null;
            if (session.BranchId != null)
            {
                var branch = await _unitOfWork.Branches.GetByIdAsync(session.BranchId.Value);
                branchName = branch?.BranchName;
            }

            return new ServerCheckSessionDto
            {
                Id = session.Id,
                CheckDate = session.CheckDate,
                BranchId = session.BranchId,
                BranchName = branchName,
                StartedAt = session.StartedAt,
                StartedBy = session.StartedBy,
                EndedAt = session.EndedAt,
                EndedBy = session.EndedBy,
                Status = session.Status,
                StatusText = session.Status.GetServerCheckSessionStatusText(),
                TotalCount = items.Count(i => i.RequiresScan),
                ScannedCount = items.Count(i => i.RequiresScan && i.Status == (int)ServerCheckItemStatus.Ok),
                Items = items.OrderBy(i => i.Category).ThenBy(i => i.DeviceCode).ToList(),
                ManualResults = manualResults
            };
        }

        private async Task<List<ServerCheckManualResultDto>> BuildManualResultsAsync(int sessionId)
        {
            var manualItems = await _unitOfWork.ServerCheckManualItems.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new { x.Id, x.Name, x.DisplayOrder, x.UsesNetworkPing }
            );

            var results = await _unitOfWork.ServerCheckManualResults.SelectAsync(
                predicate: x => x.SessionId == sessionId,
                selector: x => new { x.ManualItemId, x.Status, x.Note, x.ConfirmedBy, x.ConfirmedAt }
            );

            var resultByItem = results.ToDictionary(r => r.ManualItemId);

            return manualItems.OrderBy(m => m.DisplayOrder).Select(m =>
            {
                resultByItem.TryGetValue(m.Id, out var result);
                var status = result?.Status ?? (int)ServerCheckItemStatus.Pending;

                return new ServerCheckManualResultDto
                {
                    ManualItemId = m.Id,
                    ManualItemName = m.Name,
                    UsesNetworkPing = m.UsesNetworkPing,
                    Status = status,
                    StatusText = status.GetServerCheckItemStatusText(),
                    Note = result?.Note,
                    ConfirmedBy = result?.ConfirmedBy,
                    ConfirmedAt = result?.ConfirmedAt
                };
            }).ToList();
        }

        // Null = not assigned.
        private async Task<int?> GetAssignedBranchIdAsync()
        {
            var userId = ServerCheckUserContext.GetUserId(_httpContextAccessor);
            if (userId == null) return null;

            var rows = await _unitOfWork.ServerCheckAssignments.SelectAsync(
                predicate: a => a.UserId == userId.Value,
                selector: a => (int?)a.BranchId
            );
            return rows.FirstOrDefault();
        }

        private async Task<int> RequireAssignedBranchIdAsync()
        {
            var branchId = await GetAssignedBranchIdAsync();
            return branchId ?? throw new DomainException(
                "Tài khoản của bạn chưa được phân công xưởng kiểm tra server. Vui lòng liên hệ Admin để được phân công.");
        }

        // Only the caller's own assigned branch session, even for Admin.
        private async Task EnsureOwnBranchSessionAsync(ServerCheckSession session)
        {
            var branchId = await RequireAssignedBranchIdAsync();
            if (session.BranchId != branchId)
                throw new DomainException("Phiên kiểm tra này thuộc xưởng khác, bạn không được thao tác.");
        }

        // Viewers see every branch (optionally narrowed by `requested`); scan-only users are forced to their branch.
        // `enforceOnly`: return only the forced branch (null for viewers), for GetById which has no branch filter.
        private async Task<int?> ResolveViewBranchIdAsync(int? requested, bool enforceOnly = false)
        {
            if (ServerCheckUserContext.HasPermission(_httpContextAccessor, "Asset.ServerCheck.View"))
            {
                if (enforceOnly) return null;
                return requested ?? await GetAssignedBranchIdAsync();
            }
            return await RequireAssignedBranchIdAsync();
        }

        private string GetCurrentUser() => _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "Unknown";

        // Intermediate projection for GetReportAsync's per-category aggregation — a concrete class
        // (not an anonymous type) because it is passed into the local function Aggregate() by category.
        private sealed class ReportItemRow
        {
            public int SessionId { get; set; }
            public int Category { get; set; }
            public int Status { get; set; }
            public string? Note { get; set; }
            public string DeviceCode { get; set; } = null!;
        }

        // Intermediate projection for PingNetworkAsync — a concrete class (not anonymous) because the
        // EF projection result is captured into a lambda closure passed to Task.WhenAll/Select.
        private sealed class PingTargetRow
        {
            public string IpAddress { get; set; } = null!;
            public int DeviceId { get; set; }
            public string DeviceCode { get; set; } = null!;
            public string DeviceName { get; set; } = null!;
            public int Category { get; set; }
        }
    }
}

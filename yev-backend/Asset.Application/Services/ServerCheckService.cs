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

        public ServerCheckService(IAssetUnitOfWork unitOfWork, IHttpContextAccessor httpContextAccessor, IServerCheckTemplateService templateService) : base(unitOfWork)
        {
            _httpContextAccessor = httpContextAccessor;
            _templateService = templateService;
        }

        public async Task<ServerCheckSessionDto?> GetTodaySessionAsync()
        {
            var today = TimeHelper.GetCurrentUtcTime().Date;
            var session = await _unitOfWork.ServerCheckSessions.FirstOrDefaultAsync(x => x.CheckDate == today && !x.IsDeleted);
            return session == null ? null : await BuildSessionDtoAsync(session);
        }

        public async Task<ServerCheckSessionDto> StartSessionAsync()
        {
            var today = TimeHelper.GetCurrentUtcTime().Date;
            var existing = await _unitOfWork.ServerCheckSessions.FirstOrDefaultAsync(x => x.CheckDate == today && !x.IsDeleted);

            if (existing != null)
            {
                if (existing.Status == (int)ServerCheckSessionStatus.Completed)
                    throw new DomainException("Đã hoàn thành phiên kiểm tra hôm nay.");

                // Đã có phiên InProgress (vd trình duyệt bị đóng giữa chừng) — tiếp tục phiên đó, không tạo mới.
                return await BuildSessionDtoAsync(existing);
            }

            // Chỉ thiết bị Admin đánh dấu RequiresDailyCheck (nằm trong phòng server, có dán QR) mới được
            // snapshot vào phiên — quét QR là thao tác VẬT LÝ, nên phạm vi phải là "máy có thật trong
            // phòng", không phải "máy cùng loại/cùng chi nhánh" (asset-module.md §1.19). Lọc theo loại
            // (DeviceType.ServerCheckCategory) vẫn giữ vì báo cáo gộp cột theo loại.
            var deviceRows = await _unitOfWork.Devices.SelectAsync(
                predicate: d => !d.IsDeleted && d.Status == (int)DeviceStatus.InUse
                    && d.DeviceType.ServerCheckCategory != null && d.RequiresDailyCheck,
                selector: d => new { d.Id, Category = d.DeviceType.ServerCheckCategory!.Value }
            );

            var session = new ServerCheckSession
            {
                CheckDate = today,
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
            return await BuildSessionDtoAsync(session);
        }

        public async Task<ServerCheckItemDto> ScanAsync(int sessionId, ScanServerCheckItemDto request)
        {
            var session = (await _unitOfWork.ServerCheckSessions.GetByIdAsync(sessionId)).OrThrowNotFound("Phiên kiểm tra", sessionId);
            if (session.Status != (int)ServerCheckSessionStatus.InProgress)
                throw new DomainException("Phiên kiểm tra đã kết thúc, không thể quét thêm.");

            var deviceCode = request.DeviceCode.Trim();
            var device = await _unitOfWork.Devices.FirstOrDefaultAsync(d => d.DeviceCode == deviceCode && !d.IsDeleted);
            if (device == null) throw new DomainException($"Không tìm thấy thiết bị có mã '{deviceCode}'.");

            var item = await _unitOfWork.ServerCheckItems.FirstOrDefaultAsync(x => x.SessionId == sessionId && x.DeviceId == device.Id);
            if (item == null) throw new DomainException($"Thiết bị '{deviceCode}' không thuộc phạm vi kiểm tra hằng ngày hôm nay.");

            // Quét lại 1 máy đã Ok vẫn hợp lệ (idempotent) — chỉ cập nhật giờ quét mới nhất, không báo lỗi.
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

            foreach (var item in pendingItems)
            {
                item.Status = (int)ServerCheckItemStatus.Ng;
                item.Note = noteByItemId.TryGetValue(item.Id, out var note) ? note : null;
                _unitOfWork.ServerCheckItems.Update(item);
            }

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
                selector: x => new ServerCheckManualItemDto { Id = x.Id, Name = x.Name, DisplayOrder = x.DisplayOrder, UsesNetworkPing = x.UsesNetworkPing }
            );
            return items.OrderBy(x => x.DisplayOrder).ToList();
        }

        // Pings the IPs of Server/Network/UPS devices (asset-module.md §1.20) so staff can verify the
        // "Network - Factory"/"Network - Server" checklist items on the spot instead of by hand.
        // AirConditioner is excluded — those devices are not expected to have network IPs. Scope is
        // narrowed to AssetSetting.NetworkCheckBranchId when set (Admin-configurable), otherwise all
        // branches. Only IPs actually assigned to a Device are pinged (Available IPs have no host to
        // reach). Pings run in parallel (capped concurrency) with a short timeout so a large subnet
        // still finishes in a few seconds.
        public async Task<NetworkPingResultDto> PingNetworkAsync()
        {
            var settings = await _unitOfWork.AssetSettings.GetAllAsync();
            var branchId = settings.FirstOrDefault()?.ServerCheckBranchId;

            var targets = await _unitOfWork.IpAddresses.SelectAsync(
                predicate: ip => !ip.IsDeleted && ip.DeviceId != null
                    && !ip.Device!.IsDeleted
                    && ip.Device.Status == (int)DeviceStatus.InUse
                    && ip.Device.DeviceType.ServerCheckCategory != null
                    && ip.Device.DeviceType.ServerCheckCategory != (int)ServerCheckCategory.AirConditioner
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

            var results = new ConcurrentBag<NetworkPingItemDto>();
            using var throttle = new SemaphoreSlim(30);

            await Task.WhenAll(targets.Select(async target =>
            {
                await throttle.WaitAsync();
                try
                {
                    bool reachable;
                    long? roundtripMs = null;
                    try
                    {
                        using var ping = new Ping();
                        var reply = await ping.SendPingAsync(target.IpAddress, 1000);
                        reachable = reply.Status == IPStatus.Success;
                        if (reachable) roundtripMs = reply.RoundtripTime;
                    }
                    catch (PingException)
                    {
                        reachable = false;
                    }

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

            var items = results.OrderBy(r => r.Category).ThenBy(r => r.DeviceCode).ToList();
            return new NetworkPingResultDto
            {
                TotalCount = items.Count,
                ReachableCount = items.Count(r => r.Reachable),
                AllReachable = items.All(r => r.Reachable),
                Items = items
            };
        }

        public async Task<PagedResponse<ServerCheckSessionDto>> GetSessionsPagedAsync(int pageIndex, int pageSize, DateTime? fromDate, DateTime? toDate)
        {
            var query = _unitOfWork.ServerCheckSessions.GetQueryable(false).Where(x => !x.IsDeleted);

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
                    StartedAt = x.StartedAt,
                    StartedBy = x.StartedBy,
                    EndedAt = x.EndedAt,
                    EndedBy = x.EndedBy,
                    Status = x.Status,
                    StatusText = x.Status == (int)ServerCheckSessionStatus.InProgress ? "Đang quét" : "Đã hoàn thành",
                    TotalCount = x.Items.Count,
                    ScannedCount = x.Items.Count(i => i.Status == (int)ServerCheckItemStatus.Ok)
                }
            );
        }

        public async Task<List<ServerCheckReportRowDto>> GetReportAsync(DateTime fromDate, DateTime toDate)
        {
            var from = fromDate.Date;
            var to = toDate.Date;

            var sessions = await _unitOfWork.ServerCheckSessions.SelectAsync(
                predicate: x => !x.IsDeleted && x.CheckDate >= from && x.CheckDate <= to,
                selector: x => new { x.Id, x.CheckDate, x.Status, x.EndedBy }
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
                selector: x => new { x.SessionId, x.ManualItemId, ManualItemName = x.ManualItem.Name, x.Status, x.Note, x.ConfirmedBy, x.ConfirmedAt }
            );

            var itemsBySession = items.ToLookup(x => x.SessionId);
            var manualBySession = manualResults.ToLookup(x => x.SessionId);

            (bool? status, string? note) Aggregate(int sessionStatus, List<ReportItemRow> sessionItems, ServerCheckCategory category)
            {
                // Chưa "Kết thúc phiên" thì chưa có kết luận cuối cho ngày đó (asset-module.md §2).
                if (sessionStatus != (int)ServerCheckSessionStatus.Completed) return (null, null);

                var group = sessionItems.Where(i => i.Category == (int)category).ToList();
                if (group.Count == 0) return (null, null);

                var ngItems = group.Where(i => i.Status == (int)ServerCheckItemStatus.Ng).ToList();
                if (ngItems.Count == 0) return (true, null);

                var note = string.Join("; ", ngItems.Select(i =>
                    string.IsNullOrWhiteSpace(i.Note) ? i.DeviceCode : $"{i.DeviceCode}: {i.Note}"));
                return (false, note);
            }

            return sessions.OrderBy(s => s.CheckDate).Select(s =>
            {
                var sessionItems = itemsBySession[s.Id].ToList();

                var (serverStatus, serverNote) = Aggregate(s.Status, sessionItems, ServerCheckCategory.Server);
                var (networkStatus, networkNote) = Aggregate(s.Status, sessionItems, ServerCheckCategory.Network);
                var (upsStatus, upsNote) = Aggregate(s.Status, sessionItems, ServerCheckCategory.Ups);
                var (acStatus, acNote) = Aggregate(s.Status, sessionItems, ServerCheckCategory.AirConditioner);

                return new ServerCheckReportRowDto
                {
                    CheckDate = s.CheckDate,
                    SessionId = s.Id,
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
                    ManualResults = manualBySession[s.Id].Select(m => new ServerCheckManualResultDto
                    {
                        ManualItemId = m.ManualItemId,
                        ManualItemName = m.ManualItemName,
                        Status = m.Status,
                        StatusText = m.Status.GetServerCheckItemStatusText(),
                        Note = m.Note,
                        ConfirmedBy = m.ConfirmedBy,
                        ConfirmedAt = m.ConfirmedAt
                    }).OrderBy(m => m.ManualItemId).ToList(),
                    CheckedBy = s.EndedBy
                };
            }).ToList();
        }

        // Điền dữ liệu GetReportAsync() vào ĐÚNG layout file mẫu giấy gốc (YEV–22–CV–IT-QD-810-FR-Check
        // Sheet KT, xem Asset.Infrastructure/Templates/) thay vì tự dựng 1 bảng Excel mới — cột cố định
        // của template (B/C/D=Đèn cảnh báo Server/Network/UPS, E=Máy lạnh, F..L=7 mục thủ công theo đúng
        // thứ tự DisplayOrder, M=Người kiểm, N=Ghi chú) khớp 1-1 với ServerCheckReportRowDto nên không
        // cần build header động như màn hình web (asset-module.md §1.19/§1.20).
        public async Task<(byte[] Content, string FileName)> ExportReportAsync(DateTime fromDate, DateTime toDate)
        {
            var rows = await GetReportAsync(fromDate, toDate);
            // Thứ tự cột F..L trong file mẫu ĐÃ IN SẴN đúng tên 7 mục (Tình trạng âm thanh.../Network -
            // Factory/Server/Gởi nhận Mail/Backup - File Srv/OES/Domain) theo DisplayOrder 1..7 — không
            // ghi lại tên cột, chỉ cần map giá trị theo ĐÚNG thứ tự này, KHÔNG theo ManualItemId cụ thể
            // (id thật do DB sinh, có thể khác nhau giữa các môi trường).
            var manualItemIdsInOrder = (await GetManualItemsAsync()).Select(x => x.Id).ToList();

            using var workbook = new XLWorkbook(new MemoryStream(_templateService.GetCheckSheetTemplateBytes()));
            var sheet = workbook.Worksheet("Sheet1");

            const int templateFirstDataRow = 9;
            const int templateLastDataRow = 34; // 26 dòng trống có sẵn trong file mẫu
            const int templateRowCount = templateLastDataRow - templateFirstDataRow + 1;

            if (rows.Count < templateRowCount)
            {
                // Bớt dòng thừa (kéo theo phần chú thích/chữ ký ở dưới tự trồi lên) để không in ra
                // hàng loạt dòng trắng khi khoảng ngày lọc ngắn hơn 1 tháng.
                sheet.Rows(templateFirstDataRow + rows.Count, templateLastDataRow).Delete();
            }
            else if (rows.Count > templateRowCount)
            {
                var extraRows = rows.Count - templateRowCount;
                var templateRow = sheet.Row(templateLastDataRow);
                var inserted = templateRow.InsertRowsBelow(extraRows);
                foreach (var newRow in inserted)
                    templateRow.CopyTo(newRow);
            }

            // "Tháng"/"Năm" ở góc trên chỉ có 1 ô — chỉ điền khi cả khoảng ngày nằm gọn trong 1 tháng,
            // tránh ghi sai khi người dùng lọc báo cáo trải dài nhiều tháng.
            var singleMonth = fromDate.Year == toDate.Year && fromDate.Month == toDate.Month;
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

            for (var i = 0; i < rows.Count; i++)
            {
                var row = rows[i];
                var excelRow = templateFirstDataRow + i;

                sheet.Cell(excelRow, 1).Value = singleMonth ? row.CheckDate.Day.ToString() : row.CheckDate.ToString("dd/MM/yyyy");
                sheet.Cell(excelRow, 2).Value = StatusText(row.ServerStatus);
                sheet.Cell(excelRow, 3).Value = StatusText(row.NetworkStatus);
                sheet.Cell(excelRow, 4).Value = StatusText(row.UpsStatus);
                sheet.Cell(excelRow, 5).Value = StatusText(row.AirConditionerStatus);

                // ManualResults chỉ có dòng khi phiên đã "Kết thúc" (BE chỉ ghi ServerCheckManualResult
                // lúc EndSessionAsync) — phiên đang InProgress nên mảng này rỗng, ô tự để trống.
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

            var fileName = fromDate.Date == toDate.Date
                ? $"CheckSheet_KiemTraServer_{fromDate:yyyyMMdd}.xlsx"
                : $"CheckSheet_KiemTraServer_{fromDate:yyyyMMdd}-{toDate:yyyyMMdd}.xlsx";
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
                    // Ternary trực tiếp (không gọi extension) vì đây là Expression<Func<>> được EF dịch
                    // sang SQL — cùng lý do DeviceService.StatusText inline (§1.4 asset-module.md).
                    CategoryText = x.Category == (int)ServerCheckCategory.Server ? "Server"
                        : x.Category == (int)ServerCheckCategory.Network ? "Network"
                        : x.Category == (int)ServerCheckCategory.Ups ? "UPS"
                        : x.Category == (int)ServerCheckCategory.AirConditioner ? "Máy lạnh"
                        : "Không xác định",
                    ScannedAt = x.ScannedAt,
                    ScannedBy = x.ScannedBy,
                    Status = x.Status,
                    StatusText = x.Status == (int)ServerCheckItemStatus.Pending ? "Chưa quét"
                        : x.Status == (int)ServerCheckItemStatus.Ok ? "OK"
                        : x.Status == (int)ServerCheckItemStatus.Ng ? "NG"
                        : "Không xác định",
                    Note = x.Note
                }
            );

            var manualResults = await BuildManualResultsAsync(session.Id);

            return new ServerCheckSessionDto
            {
                Id = session.Id,
                CheckDate = session.CheckDate,
                StartedAt = session.StartedAt,
                StartedBy = session.StartedBy,
                EndedAt = session.EndedAt,
                EndedBy = session.EndedBy,
                Status = session.Status,
                StatusText = session.Status.GetServerCheckSessionStatusText(),
                TotalCount = items.Count,
                ScannedCount = items.Count(i => i.Status == (int)ServerCheckItemStatus.Ok),
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

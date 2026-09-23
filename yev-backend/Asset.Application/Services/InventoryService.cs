using Asset.Application.Dtos.Inventory;
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
    public class InventoryService : BaseService<IAssetUnitOfWork>, IInventoryService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public InventoryService(IAssetUnitOfWork unitOfWork, IHttpContextAccessor httpContextAccessor) : base(unitOfWork)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<InventorySessionDto?> GetCurrentSessionAsync()
        {
            var branchId = await RequireAssignedBranchIdAsync();
            var session = await _unitOfWork.InventorySessions.FirstOrDefaultAsync(
                x => x.BranchId == branchId && x.Status == (int)InventorySessionStatus.InProgress);
            return session == null ? null : await BuildSessionDtoAsync(session);
        }

        public async Task<InventorySessionDto> StartSessionAsync()
        {
            // Xưởng lấy từ phân công (asset-module.md §1.22), KHÔNG nhận từ client.
            var branchId = await RequireAssignedBranchIdAsync();

            var existing = await _unitOfWork.InventorySessions.FirstOrDefaultAsync(
                x => x.BranchId == branchId && x.Status == (int)InventorySessionStatus.InProgress);

            if (existing != null)
            {
                // Nhiều user cùng được gán 1 xưởng (khác ServerCheckAssignment) — người thứ 2 bấm "Bắt đầu"
                // chỉ tham gia phiên đang chạy của xưởng đó, không tạo phiên mới.
                return await BuildSessionDtoAsync(existing);
            }

            // Phạm vi 1 đợt kiểm kê = Device !IsDeleted, Status = InUse("Đang sử dụng") của xưởng (2026-09-23,
            // thu hẹp từ "mọi status trừ Liquidated" — PendingUse/PendingLiquidation không đưa vào kiểm kê,
            // quyết định người dùng, CLAUDE.md §2 luật 2).
            var deviceIds = await _unitOfWork.Devices.SelectAsync(
                predicate: d => !d.IsDeleted && d.Status == (int)DeviceStatus.InUse && d.BranchId == branchId,
                selector: d => d.Id
            );

            var session = new InventorySession
            {
                BranchId = branchId,
                StartedAt = TimeHelper.GetCurrentUtcTime(),
                StartedBy = GetCurrentUser(),
                Status = (int)InventorySessionStatus.InProgress
            };

            foreach (var deviceId in deviceIds)
            {
                session.Items.Add(new InventorySessionItem
                {
                    DeviceId = deviceId,
                    Status = (int)InventoryItemStatus.Pending
                });
            }

            await _unitOfWork.InventorySessions.AddAsync(session);
            await _unitOfWork.SaveChangesAsync();

            return await BuildSessionDtoAsync(session);
        }

        public async Task<InventorySessionDto> GetSessionByIdAsync(int id)
        {
            var session = (await _unitOfWork.InventorySessions.GetByIdAsync(id)).OrThrowNotFound("Phiên kiểm kê", id);
            var visibleBranchId = await ResolveViewBranchIdAsync(null, enforceOnly: true);
            if (visibleBranchId != null && session.BranchId != visibleBranchId)
                throw new NotFoundException("Phiên kiểm kê", id);
            return await BuildSessionDtoAsync(session);
        }

        public async Task<InventorySessionItemDto> ScanAsync(int sessionId, ScanInventoryItemDto request)
        {
            var session = (await _unitOfWork.InventorySessions.GetByIdAsync(sessionId)).OrThrowNotFound("Phiên kiểm kê", sessionId);
            if (session.Status != (int)InventorySessionStatus.InProgress)
                throw new DomainException("Phiên kiểm kê đã kết thúc, không thể quét thêm.");
            await EnsureOwnBranchSessionAsync(session);

            var deviceCode = request.DeviceCode.Trim();
            var device = await _unitOfWork.Devices.FirstOrDefaultAsync(d => d.DeviceCode == deviceCode && !d.IsDeleted);
            if (device == null) throw new DomainException($"Không tìm thấy thiết bị có mã '{deviceCode}'.");

            // Không có bản ghi item nghĩa là thiết bị này không thuộc phạm vi kiểm kê của xưởng đang chạy
            // phiên — bất kể lý do (thiết bị xưởng khác, hoặc chuyển vào xưởng này SAU khi đã snapshot).
            // Quyết định người dùng: không ghi nhận gì trong trường hợp này (CLAUDE.md §2 luật 2).
            var item = await _unitOfWork.InventorySessionItems.FirstOrDefaultAsync(x => x.SessionId == sessionId && x.DeviceId == device.Id);
            if (item == null) throw new DomainException($"Thiết bị '{deviceCode}' không thuộc phạm vi kiểm kê của xưởng này.");

            // Quét lại 1 máy đã tìm thấy vẫn hợp lệ (idempotent) — chỉ cập nhật giờ quét mới nhất.
            item.ScannedAt = TimeHelper.GetCurrentUtcTime();
            item.ScannedBy = GetCurrentUser();
            item.Status = (int)InventoryItemStatus.Found;
            item.Note = null;

            _unitOfWork.InventorySessionItems.Update(item);
            await _unitOfWork.SaveChangesAsync();

            return new InventorySessionItemDto
            {
                Id = item.Id,
                DeviceId = device.Id,
                DeviceCode = device.DeviceCode,
                DeviceName = device.DeviceName,
                ScannedAt = item.ScannedAt,
                ScannedBy = item.ScannedBy,
                Status = item.Status,
                StatusText = item.Status.GetInventoryItemStatusText(),
                Note = item.Note
            };
        }

        public async Task<InventorySessionDto> EndSessionAsync(int sessionId, EndInventorySessionDto request)
        {
            var session = (await _unitOfWork.InventorySessions.GetByIdAsync(sessionId)).OrThrowNotFound("Phiên kiểm kê", sessionId);
            if (session.Status != (int)InventorySessionStatus.InProgress)
                throw new DomainException("Phiên kiểm kê đã kết thúc.");
            await EnsureOwnBranchSessionAsync(session);

            var noteByItemId = request.Items.ToDictionary(x => x.InventorySessionItemId, x => x.Note);

            var pendingItems = await _unitOfWork.InventorySessionItems.FindAsync(
                x => x.SessionId == sessionId && x.Status == (int)InventoryItemStatus.Pending);

            foreach (var item in pendingItems)
            {
                item.Status = (int)InventoryItemStatus.Missing;
                item.Note = noteByItemId.TryGetValue(item.Id, out var note) ? note : null;
                _unitOfWork.InventorySessionItems.Update(item);
            }

            session.Status = (int)InventorySessionStatus.Completed;
            session.EndedAt = TimeHelper.GetCurrentUtcTime();
            session.EndedBy = GetCurrentUser();
            _unitOfWork.InventorySessions.Update(session);

            await _unitOfWork.SaveChangesAsync();

            return await BuildSessionDtoAsync(session);
        }

        public async Task<PagedResponse<InventorySessionDto>> GetSessionsPagedAsync(int pageIndex, int pageSize, DateTime? fromDate, DateTime? toDate, int? branchId)
        {
            var effectiveBranchId = await ResolveViewBranchIdAsync(branchId);
            var query = _unitOfWork.InventorySessions.GetQueryable(false);
            if (effectiveBranchId != null) query = query.Where(x => x.BranchId == effectiveBranchId);

            if (fromDate.HasValue) query = query.Where(x => x.StartedAt >= fromDate.Value.Date);
            if (toDate.HasValue) query = query.Where(x => x.StartedAt < toDate.Value.Date.AddDays(1));

            return await _unitOfWork.InventorySessions.ToPagedResponseAsync(
                query.OrderByDescending(x => x.StartedAt),
                pageIndex,
                pageSize,
                x => new InventorySessionDto
                {
                    Id = x.Id,
                    BranchId = x.BranchId,
                    BranchName = x.Branch.BranchName,
                    StartedAt = x.StartedAt,
                    StartedBy = x.StartedBy,
                    EndedAt = x.EndedAt,
                    EndedBy = x.EndedBy,
                    Status = x.Status,
                    StatusText = x.Status.GetInventorySessionStatusText(),
                    TotalCount = x.Items.Count,
                    FoundCount = x.Items.Count(i => i.Status == (int)InventoryItemStatus.Found),
                    MissingCount = x.Items.Count(i => i.Status == (int)InventoryItemStatus.Missing)
                }
            );
        }

        public async Task<List<InventoryReportRowDto>> GetReportAsync(DateTime fromDate, DateTime toDate, int? branchId)
        {
            var from = fromDate.Date;
            var to = toDate.Date.AddDays(1);
            var effectiveBranchId = await ResolveViewBranchIdAsync(branchId);

            var sessions = await _unitOfWork.InventorySessions.SelectAsync(
                predicate: x => x.StartedAt >= from && x.StartedAt < to && (effectiveBranchId == null || x.BranchId == effectiveBranchId),
                selector: x => new
                {
                    x.Id,
                    x.BranchId,
                    BranchName = x.Branch.BranchName,
                    x.StartedAt,
                    x.EndedAt,
                    x.EndedBy,
                    x.Status
                }
            );

            if (sessions.Count == 0) return new List<InventoryReportRowDto>();

            var sessionIds = sessions.Select(s => s.Id).ToList();

            var items = await _unitOfWork.InventorySessionItems.SelectAsync(
                predicate: x => sessionIds.Contains(x.SessionId),
                selector: x => new { x.SessionId, x.Status, x.Note, x.Device.DeviceCode, x.Device.DeviceName }
            );

            var itemsBySession = items.ToLookup(x => x.SessionId);

            return sessions.OrderByDescending(s => s.StartedAt).Select(s =>
            {
                var sessionItems = itemsBySession[s.Id].ToList();
                var missingItems = sessionItems
                    .Where(i => i.Status == (int)InventoryItemStatus.Missing)
                    .Select(i => new InventoryMissingItemDto { DeviceCode = i.DeviceCode, DeviceName = i.DeviceName, Note = i.Note })
                    .ToList();

                return new InventoryReportRowDto
                {
                    SessionId = s.Id,
                    BranchId = s.BranchId,
                    BranchName = s.BranchName,
                    StartedAt = s.StartedAt,
                    EndedAt = s.EndedAt,
                    Status = s.Status,
                    StatusText = s.Status.GetInventorySessionStatusText(),
                    TotalCount = sessionItems.Count,
                    FoundCount = sessionItems.Count(i => i.Status == (int)InventoryItemStatus.Found),
                    MissingCount = missingItems.Count,
                    MissingItems = missingItems,
                    CheckedBy = s.EndedBy
                };
            }).ToList();
        }

        // Không có file mẫu công ty cho kiểm kê (khác ServerCheck) — tự dựng workbook mới bằng ClosedXML,
        // layout riêng (CLAUDE.md §4.8 chỉ bắt buộc PDF phải vẽ ở FE, Excel do BE dựng vẫn hợp lệ).
        public async Task<(byte[] Content, string FileName)> ExportReportAsync(DateTime fromDate, DateTime toDate, int? branchId)
        {
            var rows = await GetReportAsync(fromDate, toDate, branchId);

            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("Kiểm kê thiết bị");

            string[] headers = { "Xưởng", "Bắt đầu", "Kết thúc", "Trạng thái", "Tổng số", "Đã kiểm kê", "Thiếu", "Người kết thúc", "Danh sách thiết bị thiếu" };
            for (var col = 0; col < headers.Length; col++)
                sheet.Cell(1, col + 1).Value = headers[col];
            sheet.Row(1).Style.Font.Bold = true;

            for (var i = 0; i < rows.Count; i++)
            {
                var row = rows[i];
                var excelRow = i + 2;

                sheet.Cell(excelRow, 1).Value = row.BranchName ?? string.Empty;
                sheet.Cell(excelRow, 2).Value = row.StartedAt;
                sheet.Cell(excelRow, 2).Style.DateFormat.Format = "dd/MM/yyyy HH:mm";
                if (row.EndedAt.HasValue)
                {
                    sheet.Cell(excelRow, 3).Value = row.EndedAt.Value;
                    sheet.Cell(excelRow, 3).Style.DateFormat.Format = "dd/MM/yyyy HH:mm";
                }
                sheet.Cell(excelRow, 4).Value = row.StatusText;
                sheet.Cell(excelRow, 5).Value = row.TotalCount;
                sheet.Cell(excelRow, 6).Value = row.FoundCount;
                sheet.Cell(excelRow, 7).Value = row.MissingCount;
                sheet.Cell(excelRow, 8).Value = row.CheckedBy ?? string.Empty;
                sheet.Cell(excelRow, 9).Value = string.Join("; ", row.MissingItems.Select(m =>
                    string.IsNullOrWhiteSpace(m.Note) ? $"{m.DeviceCode} - {m.DeviceName}" : $"{m.DeviceCode} - {m.DeviceName}: {m.Note}"));
            }

            sheet.Columns().AdjustToContents();

            using var output = new MemoryStream();
            workbook.SaveAs(output);

            var fileName = fromDate.Date == toDate.Date
                ? $"KiemKeThietBi_{fromDate:yyyyMMdd}.xlsx"
                : $"KiemKeThietBi_{fromDate:yyyyMMdd}-{toDate:yyyyMMdd}.xlsx";
            return (output.ToArray(), fileName);
        }

        private async Task<InventorySessionDto> BuildSessionDtoAsync(InventorySession session)
        {
            var items = await _unitOfWork.InventorySessionItems.SelectAsync(
                predicate: x => x.SessionId == session.Id,
                selector: x => new InventorySessionItemDto
                {
                    Id = x.Id,
                    DeviceId = x.DeviceId,
                    DeviceCode = x.Device.DeviceCode,
                    DeviceName = x.Device.DeviceName,
                    ScannedAt = x.ScannedAt,
                    ScannedBy = x.ScannedBy,
                    Status = x.Status,
                    StatusText = x.Status == (int)InventoryItemStatus.Pending ? "Chưa kiểm kê"
                        : x.Status == (int)InventoryItemStatus.Found ? "Đã tìm thấy"
                        : x.Status == (int)InventoryItemStatus.Missing ? "Thiếu"
                        : "Không xác định",
                    Note = x.Note
                }
            );

            var branch = await _unitOfWork.Branches.GetByIdAsync(session.BranchId);

            return new InventorySessionDto
            {
                Id = session.Id,
                BranchId = session.BranchId,
                BranchName = branch?.BranchName,
                StartedAt = session.StartedAt,
                StartedBy = session.StartedBy,
                EndedAt = session.EndedAt,
                EndedBy = session.EndedBy,
                Status = session.Status,
                StatusText = session.Status.GetInventorySessionStatusText(),
                TotalCount = items.Count,
                FoundCount = items.Count(i => i.Status == (int)InventoryItemStatus.Found),
                MissingCount = items.Count(i => i.Status == (int)InventoryItemStatus.Missing),
                Items = items.OrderBy(i => i.DeviceCode).ToList()
            };
        }

        // Xưởng user hiện tại được phân công (asset-module.md §1.22); null = chưa được phân công.
        private async Task<int?> GetAssignedBranchIdAsync()
        {
            var userId = ServerCheckUserContext.GetUserId(_httpContextAccessor);
            if (userId == null) return null;

            var rows = await _unitOfWork.InventoryAssignments.SelectAsync(
                predicate: a => a.UserId == userId.Value,
                selector: a => (int?)a.BranchId
            );
            return rows.FirstOrDefault();
        }

        private async Task<int> RequireAssignedBranchIdAsync()
        {
            var branchId = await GetAssignedBranchIdAsync();
            return branchId ?? throw new DomainException(
                "Tài khoản của bạn chưa được phân công xưởng kiểm kê thiết bị. Vui lòng liên hệ Admin để được phân công.");
        }

        // Quét/kết thúc phiên chỉ được làm trên phiên của ĐÚNG xưởng mình được phân công — kể cả Admin.
        private async Task EnsureOwnBranchSessionAsync(InventorySession session)
        {
            var branchId = await RequireAssignedBranchIdAsync();
            if (session.BranchId != branchId)
                throw new DomainException("Phiên kiểm kê này thuộc xưởng khác, bạn không được thao tác.");
        }

        // Which branch a READ endpoint is limited to. Users holding Asset.Inventory.View see every
        // branch (optionally narrowed by `requested`); scan-only users are forced to their assigned
        // branch. `enforceOnly`: return only the forced branch (null for viewers) - used by GetById.
        private async Task<int?> ResolveViewBranchIdAsync(int? requested, bool enforceOnly = false)
        {
            if (ServerCheckUserContext.HasPermission(_httpContextAccessor, "Asset.Inventory.View"))
            {
                if (enforceOnly) return null;
                return requested ?? await GetAssignedBranchIdAsync();
            }
            return await RequireAssignedBranchIdAsync();
        }

        private string GetCurrentUser() => _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "Unknown";
    }
}

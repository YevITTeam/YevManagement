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

            // Phạm vi 1 đợt kiểm kê = Device !IsDeleted, Status = InUse("Đang sử dụng") của xưởng, và loại
            // thiết bị đang bật DeviceType.IncludedInInventory (quyết định người dùng, AGENTS.md §2 luật 2).
            var deviceIds = await _unitOfWork.Devices.SelectAsync(
                predicate: d => !d.IsDeleted && d.Status == (int)DeviceStatus.InUse && d.BranchId == branchId
                    && d.DeviceType.IncludedInInventory,
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
            // Quyết định người dùng: không ghi nhận gì trong trường hợp này (AGENTS.md §2 luật 2).
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

        // Không có file mẫu công ty cho kiểm kê (khác ServerCheck) — tự dựng workbook mới bằng ClosedXML,
        // layout riêng (AGENTS.md §4.8 chỉ bắt buộc PDF phải vẽ ở FE, Excel do BE dựng vẫn hợp lệ).
        // 1 dòng = 1 thiết bị của phiên, cùng dữ liệu với màn báo cáo.
        public async Task<(byte[] Content, string FileName)> ExportSessionAsync(int sessionId)
        {
            var session = await GetSessionByIdAsync(sessionId);

            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("Kiểm kê thiết bị");

            sheet.Cell(1, 1).Value = $"Kiểm kê thiết bị - {session.BranchName}";
            sheet.Cell(1, 1).Style.Font.Bold = true;
            sheet.Cell(2, 1).Value = $"Bắt đầu: {session.StartedAt:dd/MM/yyyy HH:mm}"
                + (session.EndedAt.HasValue ? $" - Kết thúc: {session.EndedAt.Value:dd/MM/yyyy HH:mm}" : string.Empty)
                + $" - {session.StatusText}";
            sheet.Cell(3, 1).Value = $"Tổng: {session.TotalCount} - Đã kiểm: {session.FoundCount} - Thiếu: {session.MissingCount}";

            string[] headers = { "STT", "Mã máy", "Tên thiết bị", "Loại", "Người quản lý", "Nhóm", "Bộ phận", "Serial", "Trạng thái", "Người kiểm", "Thời điểm kiểm", "Ghi chú" };
            const int headerRow = 5;
            for (var col = 0; col < headers.Length; col++)
                sheet.Cell(headerRow, col + 1).Value = headers[col];
            sheet.Range(headerRow, 1, headerRow, headers.Length).Style.Font.Bold = true;

            for (var i = 0; i < session.Items.Count; i++)
            {
                var item = session.Items[i];
                var r = headerRow + 1 + i;

                sheet.Cell(r, 1).Value = i + 1;
                sheet.Cell(r, 2).Value = item.DeviceCode;
                sheet.Cell(r, 3).Value = item.DeviceName;
                sheet.Cell(r, 4).Value = item.DeviceTypeName ?? string.Empty;
                sheet.Cell(r, 5).Value = item.Manager ?? string.Empty;
                sheet.Cell(r, 6).Value = item.GroupName ?? string.Empty;
                sheet.Cell(r, 7).Value = item.DepartmentName ?? string.Empty;
                sheet.Cell(r, 8).Value = item.SerialNumber ?? string.Empty;
                sheet.Cell(r, 9).Value = item.StatusText;
                sheet.Cell(r, 10).Value = item.ScannedBy ?? string.Empty;
                if (item.ScannedAt.HasValue)
                {
                    sheet.Cell(r, 11).Value = item.ScannedAt.Value;
                    sheet.Cell(r, 11).Style.DateFormat.Format = "dd/MM/yyyy HH:mm";
                }
                sheet.Cell(r, 12).Value = item.Note ?? string.Empty;
            }

            sheet.Columns().AdjustToContents();

            using var output = new MemoryStream();
            workbook.SaveAs(output);

            return (output.ToArray(), $"KiemKeThietBi_{session.BranchName}_{session.StartedAt:yyyyMMdd}.xlsx");
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
                    DeviceTypeName = x.Device.DeviceType.TypeName,
                    Manager = x.Device.Manager,
                    GroupName = x.Device.DeviceGroup != null ? x.Device.DeviceGroup.GroupName : null,
                    DepartmentName = x.Device.DeviceDepartment != null ? x.Device.DeviceDepartment.DepartmentName : null,
                    SerialNumber = x.Device.SerialNumber,
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

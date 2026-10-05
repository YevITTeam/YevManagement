using Attendance.Application.Dtos.AttendanceSettings;
using Attendance.Application.Dtos.ProductionEmployees;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Shared.Application.Helper;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Phục vụ màn "Theo chuyền" khi tạo đơn OT (2026-08-24) — tìm người theo Line/Team/Nhóm
    // ca/CongDoan thay vì theo Group cố định (xem OtFormService.CreateProductionFormAsync). CHỈ trả
    // về người ĐÃ có EmployeeId (bảng ProductionEmployees vốn chỉ chứa dòng đã resolve đủ theo policy
    // nạp, xem ProductionEmployee.cs) — không cần lọc thêm ở đây.
    public class ProductionEmployeeService : BaseService<IAttendanceUnitOfWork>, IProductionEmployeeService
    {
        private readonly IAttendanceSettingService _attendanceSettingService;
        private readonly IDepartmentAccessGuard _departmentAccessGuard;

        public ProductionEmployeeService(
            IAttendanceUnitOfWork unitOfWork, IAttendanceSettingService attendanceSettingService, IDepartmentAccessGuard departmentAccessGuard)
            : base(unitOfWork)
        {
            _attendanceSettingService = attendanceSettingService;
            _departmentAccessGuard = departmentAccessGuard;
        }

        // targetDate = ngày trên đơn đang tạo (2026-08-26, mirror EmployeeService.GetByGroupIdAsync) —
        // thêm lũy kế DỰ KIẾN để cảnh báo vượt giới hạn ngày/tháng/năm NGAY lúc chọn người ở màn "Theo
        // chuyền" (trước đây bảng này không có cảnh báo gì, khác bảng "Theo Nhóm" đã có từ 2026-08-06).
        public async Task<List<ProductionEmployeeSearchItemDto>> SearchAsync(
            int? productionLineId, int? teamId, int? shiftTeamId, string? congDoan, string? keyword, DateOnly? targetDate)
        {
            var trimmedKeyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();

            var items = await _unitOfWork.ProductionEmployees.SelectAsync(
                predicate: x => !x.IsDeleted && x.EmployeeId != null
                    && (productionLineId == null || x.ProductionLineId == productionLineId)
                    && (teamId == null || x.TeamId == teamId)
                    && (shiftTeamId == null || x.ShiftTeamId == shiftTeamId)
                    && (congDoan == null || x.CongDoan == congDoan)
                    && (trimmedKeyword == null
                        || x.EmployeeCode.Contains(trimmedKeyword)
                        || x.Employee!.LastName.Contains(trimmedKeyword)
                        || x.Employee!.FirstName.Contains(trimmedKeyword)),
                selector: x => new ProductionEmployeeSearchItemDto
                {
                    EmployeeId = x.EmployeeId!.Value,
                    EmployeeCode = x.Employee!.Code,
                    FullName = x.Employee!.LastName + " " + x.Employee!.FirstName,
                    CongDoan = x.CongDoan,
                    TaskName = x.TaskName,
                    BlockCode = x.BlockCode,
                    TeamCode = x.TeamCode,
                    ShiftTeamCode = x.ShiftTeamCode,
                    ShiftTeamNameVn = x.ShiftTeam != null ? x.ShiftTeam.NameVn : null,
                    IsLeader = x.IsLeader,
                    CustomMonthlyOtHourLimit = x.Employee!.CustomMonthlyOtHourLimit,
                    CustomYearlyOtHourLimit = x.Employee!.CustomYearlyOtHourLimit
                });

            var result = items.OrderBy(x => x.EmployeeCode.Length).ThenBy(x => x.EmployeeCode).ToList();
            if (result.Count == 0) return result;

            var target = targetDate ?? DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());
            var mealSettings = await _attendanceSettingService.GetAsync();
            var employeeIds = result.Select(x => x.EmployeeId).ToList();

            // Same projection rule as OtFormService.ComputeAccumulatedHoursBatchAsync: Day from every valid form,
            // Month/Year from the ledger plus forms still InApproval (Completed forms are already in the ledger).
            var rows = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => employeeIds.Contains(x.EmployeeId) && !x.IsRemoved && x.OtForm.Status != (int)OtFormStatus.Rejected
                     && !x.OtForm.IsDeleted && x.OtForm.Date.Year == target.Year,
                x => x.OtForm);
            var ledgerRows = await _unitOfWork.EmployeeAccumulationHistories.FindAsync(
                x => employeeIds.Contains(x.EmployeeId) && x.Year == target.Year);

            var rowsByEmployee = rows.ToLookup(x => x.EmployeeId);
            var ledgerByEmployee = ledgerRows.ToLookup(x => x.EmployeeId);
            foreach (var item in result)
            {
                var employeeRows = rowsByEmployee[item.EmployeeId].ToList();
                var pendingRows = employeeRows.Where(x => x.OtForm.Status != (int)OtFormStatus.Completed).ToList();
                var ledger = ledgerByEmployee[item.EmployeeId].ToList();

                item.ProjectedDayToDate = employeeRows.Where(x => x.OtForm.Date == target)
                    .Sum(x => CalculateProjectedHours(x, mealSettings));
                item.ProjectedMonthToDate = ledger.Where(x => x.Month == target.Month).Sum(x => x.TotalHours)
                    + pendingRows.Where(x => x.OtForm.Date.Month == target.Month).Sum(x => CalculateProjectedHours(x, mealSettings));
                item.ProjectedYearToDate = ledger.Sum(x => x.TotalHours)
                    + pendingRows.Sum(x => CalculateProjectedHours(x, mealSettings));
            }

            return result;
        }

        // Mirror EmployeeService.CalculateProjectedHours/OtFormService.CalculateOtHours — mỗi service tự
        // chứa logic tính giờ của mình, không gọi chéo (quy ước đã có từ redesign 3 bậc phiếu ăn 2026-08-26).
        private static decimal CalculateProjectedHours(OtFormEmployee row, AttendanceSettingDto mealSettings)
        {
            var hours = Math.Round((decimal)(row.EndTime - row.StartTime).TotalHours, 2);
            var isEarlyWindow = row.StartTime == mealSettings.EarlyMealWindowStartTime && row.EndTime == mealSettings.EarlyMealWindowEndTime;
            if (!isEarlyWindow && row.DidEat) hours -= mealSettings.MealBreakDeductionHours;
            return hours;
        }

        // teamId lọc Line theo đúng Team đã chọn — ProductionLine.TeamId là FK thật (xem ProductionLine.cs),
        // Team chứa Line CHỨ KHÔNG PHẢI ngược lại, nên chỉ Line mới cần tham số cascade này (2026-08-25).
        public async Task<List<ProductionOptionDto>> GetLineOptionsAsync(int? teamId)
        {
            if (teamId == null)
            {
                var allItems = await _unitOfWork.ProductionLines.SelectAsync(
                    predicate: x => !x.IsDeleted,
                    selector: x => new ProductionOptionDto { Id = x.Id, Code = x.LineCode, NameVn = null });
                return allItems.OrderBy(x => x.Code.Length).ThenBy(x => x.Code).ToList();
            }

            // ProductionLine.TeamId là snapshot TĨNH từ file tham chiếu gốc lúc dựng FK (2026-08-21,
            // xem migration ConnectProductionLineToTeam), không cập nhật lại theo thời gian — trong khi
            // Team thật của nhân viên (ProductionEmployee.TeamId) được nạp lại mỗi tháng, nên 1 Line có
            // thể đã đổi Team thực tế mà FK tĩnh không biết. Lọc theo FK tĩnh khiến FE cho chọn 1 tổ hợp
            // Team+Line rồi search ra danh sách rỗng. Suy Line có sẵn theo Team TỪ DỮ LIỆU THẬT
            // (ProductionEmployees) — cùng cách đã áp dụng cho GetShiftTeamOptionsAsync bên dưới từ
            // 2026-08-25 (2026-09-05, theo yêu cầu người dùng).
            var items = await _unitOfWork.ProductionEmployees.SelectAsync(
                predicate: x => !x.IsDeleted && x.EmployeeId != null && x.ProductionLineId != null && x.TeamId == teamId,
                selector: x => new ProductionOptionDto { Id = x.ProductionLineId!.Value, Code = x.ProductionLine!.LineCode, NameVn = null });

            return items.DistinctBy(x => x.Id).OrderBy(x => x.Code.Length).ThenBy(x => x.Code).ToList();
        }

        public async Task<List<ProductionOptionDto>> GetTeamOptionsAsync()
        {
            var items = await _unitOfWork.ProductionTeams.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new ProductionOptionDto { Id = x.Id, Code = x.Code, NameVn = x.NameVn });
            return items.OrderBy(x => x.Code.Length).ThenBy(x => x.Code).ToList();
        }

        // Nhóm ca KHÔNG phải con của Line/Team (1 Line có thể xuất hiện ở nhiều Nhóm ca khác nhau, xem
        // ProductionShiftTeam.cs) nên không lọc được bằng FK như GetLineOptionsAsync — thay vào đó suy
        // ra TỪ DỮ LIỆU THẬT: chỉ trả về Nhóm ca nào thực sự có người trong đúng tập Line/Team đang lọc
        // (2026-08-25, theo yêu cầu người dùng — tránh cho chọn Nhóm ca rồi tìm ra danh sách rỗng).
        public async Task<List<ProductionOptionDto>> GetShiftTeamOptionsAsync(int? productionLineId, int? teamId)
        {
            var items = await _unitOfWork.ProductionEmployees.SelectAsync(
                predicate: x => !x.IsDeleted && x.EmployeeId != null && x.ShiftTeamId != null
                    && (productionLineId == null || x.ProductionLineId == productionLineId)
                    && (teamId == null || x.TeamId == teamId),
                selector: x => new ProductionOptionDto { Id = x.ShiftTeamId!.Value, Code = x.ShiftTeam!.Code, NameVn = x.ShiftTeam!.NameVn });

            return items.DistinctBy(x => x.Id).OrderBy(x => x.Code.Length).ThenBy(x => x.Code).ToList();
        }

        // Màn "Nhân viên dưới chuyền" — view riêng đọc thẳng ProductionEmployees (khác EmployeeService,
        // đọc bảng Employees) để hiển thị đúng dữ liệu chuyền mới nhất (Line/Team/Nhóm ca/Công đoạn)
        // (2026-08-27, theo yêu cầu người dùng). Nguồn chính vẫn là Import Excel (nạp lại đè hết mỗi
        // tháng) — UpdateAsync bên dưới (2026-09-04) chỉ để sửa nhanh Line/Team/Nhóm ca/Trưởng nhóm
        // giữa 2 đợt import, sẽ bị GHI ĐÈ lại đúng theo file ở lần import kế tiếp.
        public async Task<PagedResponse<ProductionEmployeeListItemDto>> GetPagedAsync(
            string callerUserName, bool isAdmin, int pageIndex, int pageSize, string? keyword,
            int? productionLineId, int? teamId, int? shiftTeamId, int? departmentId)
        {
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var trimmedKeyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();

            // Scope theo Người phụ trách BỘ PHẬN (2026-09-28, theo yêu cầu người dùng — "dữ liệu dưới
            // chuyền" là khái niệm cấp Phòng ban, CHỈ Người phụ trách Bộ phận mới có quyền thao tác,
            // KHÔNG cấp cho Người phụ trách Nhóm dù đúng lý luôn giống mô hình dept-or-group ở các chỗ
            // khác — xem ApprovalStepCoordinatorPermissions.ProductionEmployeeViewCode). Admin bỏ qua;
            // không Admin thì chỉ thấy nhân sự dưới chuyền thuộc Bộ phận mình phụ trách. Dòng
            // ProductionEmployee CHƯA gắn Employee (chưa resolve) không xác định được phạm vi nên luôn
            // bị ẩn khỏi người xem có scope hẹp.
            var managedDepartmentIds = isAdmin ? null : await _departmentAccessGuard.GetManagedDepartmentIdsAsync(callerUserName);

            var query = _unitOfWork.ProductionEmployees.GetQueryable(false).Where(x => !x.IsDeleted
                && (productionLineId == null || x.ProductionLineId == productionLineId)
                && (teamId == null || x.TeamId == teamId)
                && (shiftTeamId == null || x.ShiftTeamId == shiftTeamId)
                && (departmentId == null || (x.Employee != null && x.Employee.Group != null && x.Employee.Group.DepartmentId == departmentId))
                && (trimmedKeyword == null
                    || x.EmployeeCode.Contains(trimmedKeyword)
                    || (x.Employee != null && (x.Employee.LastName.Contains(trimmedKeyword) || x.Employee.FirstName.Contains(trimmedKeyword))))
                && (isAdmin || (x.EmployeeId != null && x.Employee != null && (
                        (x.Employee.DepartmentId != null && managedDepartmentIds!.Contains(x.Employee.DepartmentId.Value))
                        || (x.Employee.Group != null && managedDepartmentIds!.Contains(x.Employee.Group.DepartmentId))))));

            var orderedQuery = query.OrderBy(x => x.EmployeeCode.Length).ThenBy(x => x.EmployeeCode);

            return await _unitOfWork.ProductionEmployees.ToPagedResponseAsync(
                orderedQuery,
                pageIndex,
                pageSize,
                x => new ProductionEmployeeListItemDto
                {
                    Id = x.Id,
                    EmployeeId = x.EmployeeId,
                    EmployeeCode = x.EmployeeCode,
                    FullName = x.Employee != null ? x.Employee.LastName + " " + x.Employee.FirstName : x.EmployeeCode,
                    CongDoan = x.CongDoan,
                    TaskName = x.TaskName,
                    BlockCode = x.BlockCode,
                    ProductionLineId = x.ProductionLineId,
                    TeamCode = x.TeamCode,
                    TeamNameVn = x.Team != null ? x.Team.NameVn : null,
                    TeamId = x.TeamId,
                    ShiftTeamCode = x.ShiftTeamCode,
                    ShiftTeamNameVn = x.ShiftTeam != null ? x.ShiftTeam.NameVn : null,
                    ShiftTeamId = x.ShiftTeamId,
                    IsLeader = x.IsLeader,
                    DepartmentNameVn = x.Employee != null && x.Employee.Group != null && x.Employee.Group.Department != null
                        ? x.Employee.Group.Department.DepartmentNameVn
                        : null,
                    MonthToDate = x.EmployeeId != null
                        ? x.Employee!.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month == todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m
                        : 0m,
                    YearToDate = x.EmployeeId != null
                        ? x.Employee!.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month <= todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m
                        : 0m
                });
        }

        // Mirror EmployeeService.GetTodayYearMonth — lũy kế luôn scope theo năm/tháng THỰC TẾ hôm nay.
        private static (int Year, int Month) GetTodayYearMonth()
        {
            var today = DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());
            return (today.Year, today.Month);
        }

        // Sửa tay Line/Team/Nhóm ca/Trưởng nhóm (2026-09-04) — bổ sung cho Import Excel, dùng khi cần
        // sửa nhanh 1-2 người giữa 2 đợt import. LUÔN ghi lại cả cặp Id+Code từ đúng entity đang chọn
        // (không nhận Code tay từ FE) để BlockCode/TeamCode/ShiftTeamCode không bao giờ lệch khỏi FK —
        // IsLeader ảnh hưởng trực tiếp candidate duyệt "theo chuyền" của Line này
        // (JobTitleApprovalChainService, xem docs §Cây duyệt Chuyền), ghi thẳng không cần đồng bộ gì
        // thêm (đọc SỐNG lúc resolve chuỗi duyệt, không cache ở đâu khác).
        public async Task UpdateAsync(int id, UpdateProductionEmployeeDto request, string callerUserName, bool isAdmin)
        {
            var entity = (await _unitOfWork.ProductionEmployees.GetByIdAsync(id)).OrThrowNotFound("Nhân viên dưới chuyền", id);

            // Scope theo Bộ phận phụ trách (2026-09-28, theo yêu cầu người dùng — cùng mô hình
            // GetPagedAsync, CHỈ Bộ phận). Dòng chưa gắn Employee (chưa resolve) không xác định được
            // Bộ phận nên non-Admin luôn bị chặn.
            if (!isAdmin)
            {
                int? resolvedDepartmentId = null;
                if (entity!.EmployeeId.HasValue)
                {
                    var employee = (await _unitOfWork.Employees.SelectAsync(
                        x => x.Id == entity.EmployeeId.Value,
                        x => new { x.DepartmentId, GroupDepartmentId = x.Group != null ? (int?)x.Group.DepartmentId : null }))
                        .FirstOrDefault();
                    resolvedDepartmentId = employee?.DepartmentId ?? employee?.GroupDepartmentId;
                }

                var managedDepartmentIds = await _departmentAccessGuard.GetManagedDepartmentIdsAsync(callerUserName);
                if (resolvedDepartmentId == null || !managedDepartmentIds.Contains(resolvedDepartmentId.Value))
                    throw new DomainException("Bạn chỉ được sửa nhân sự dưới chuyền thuộc Bộ phận mình phụ trách.");
            }

            if (request.ProductionLineId.HasValue)
            {
                var line = (await _unitOfWork.ProductionLines.GetByIdAsync(request.ProductionLineId.Value))
                    .OrThrowNotFound("Line", request.ProductionLineId.Value);
                entity!.ProductionLineId = line!.Id;
                entity.BlockCode = line.LineCode;
            }
            else
            {
                entity!.ProductionLineId = null;
                entity.BlockCode = null;
            }

            if (request.TeamId.HasValue)
            {
                var team = (await _unitOfWork.ProductionTeams.GetByIdAsync(request.TeamId.Value))
                    .OrThrowNotFound("Team", request.TeamId.Value);
                entity.TeamId = team!.Id;
                entity.TeamCode = team.Code;
            }
            else
            {
                entity.TeamId = null;
                entity.TeamCode = null;
            }

            if (request.ShiftTeamId.HasValue)
            {
                var shiftTeam = (await _unitOfWork.ProductionShiftTeams.GetByIdAsync(request.ShiftTeamId.Value))
                    .OrThrowNotFound("Nhóm ca", request.ShiftTeamId.Value);
                entity.ShiftTeamId = shiftTeam!.Id;
                entity.ShiftTeamCode = shiftTeam.Code;
            }
            else
            {
                entity.ShiftTeamId = null;
                entity.ShiftTeamCode = null;
            }

            entity.IsLeader = request.IsLeader;

            _unitOfWork.ProductionEmployees.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}

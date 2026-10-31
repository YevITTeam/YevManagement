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
    // Picks people by Line/Team/shift/CongDoan for production forms; ProductionEmployees only holds resolved rows, so no extra EmployeeId filter.
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

        private const int MaxSearchResults = 500;

        // targetDate = the form's date, used to project accumulation and warn about limits while picking people.
        public async Task<List<ProductionEmployeeSearchItemDto>> SearchAsync(
            int? productionLineId, int? teamId, int? shiftTeamId, string? congDoan, string? keyword, DateOnly? targetDate)
        {
            var trimmedKeyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();

            // An unfiltered search would return (and project accumulation for) every production employee.
            if (productionLineId == null && teamId == null && shiftTeamId == null && congDoan == null && trimmedKeyword == null)
                throw new DomainException("Vui lòng chọn Team/Line/Nhóm ca hoặc nhập từ khoá để tìm nhân viên.");

            var filtered = _unitOfWork.ProductionEmployees.GetQueryable().Where(x => !x.IsDeleted && x.EmployeeId != null
                    && (productionLineId == null || x.ProductionLineId == productionLineId)
                    && (teamId == null || x.TeamId == teamId)
                    && (shiftTeamId == null || x.ShiftTeamId == shiftTeamId)
                    && (congDoan == null || x.CongDoan == congDoan)
                    && (trimmedKeyword == null
                        || x.EmployeeCode.Contains(trimmedKeyword)
                        || x.Employee!.LastName.Contains(trimmedKeyword)
                        || x.Employee!.FirstName.Contains(trimmedKeyword)));
            var items = await _unitOfWork.ProductionEmployees.ToListAsync(
                filtered.OrderBy(x => x.EmployeeCode.Length).ThenBy(x => x.EmployeeCode).Take(MaxSearchResults),
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
                    .Sum(x => MealTicketCalculator.CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings));
                item.ProjectedMonthToDate = ledger.Where(x => x.Month == target.Month).Sum(x => x.TotalHours)
                    + pendingRows.Where(x => x.OtForm.Date.Month == target.Month).Sum(x => MealTicketCalculator.CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings));
                item.ProjectedYearToDate = ledger.Sum(x => x.TotalHours)
                    + pendingRows.Sum(x => MealTicketCalculator.CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings));
            }

            return result;
        }

        // Only Line needs the team cascade: a Team contains Lines, not the reverse.
        public async Task<List<ProductionOptionDto>> GetLineOptionsAsync(int? teamId)
        {
            if (teamId == null)
            {
                var allItems = await _unitOfWork.ProductionLines.SelectAsync(
                    predicate: x => !x.IsDeleted,
                    selector: x => new ProductionOptionDto { Id = x.Id, Code = x.LineCode, NameVn = null });
                return allItems.OrderBy(x => x.Code.Length).ThenBy(x => x.Code).ToList();
            }

            // ProductionLine.TeamId is a static snapshot while employees' teams are reloaded monthly, so derive the
            // Team->Line options from actual ProductionEmployees to avoid combos that return nothing.
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

        // Shift teams are not children of Line/Team, so options are derived from actual data to avoid empty results.
        public async Task<List<ProductionOptionDto>> GetShiftTeamOptionsAsync(int? productionLineId, int? teamId)
        {
            var items = await _unitOfWork.ProductionEmployees.SelectAsync(
                predicate: x => !x.IsDeleted && x.EmployeeId != null && x.ShiftTeamId != null
                    && (productionLineId == null || x.ProductionLineId == productionLineId)
                    && (teamId == null || x.TeamId == teamId),
                selector: x => new ProductionOptionDto { Id = x.ShiftTeamId!.Value, Code = x.ShiftTeam!.Code, NameVn = x.ShiftTeam!.NameVn });

            return items.DistinctBy(x => x.Id).OrderBy(x => x.Code.Length).ThenBy(x => x.Code).ToList();
        }

        // Reads ProductionEmployees directly for the latest line data. Import is the main source; manual edits
        // are overwritten by the next import.
        public async Task<PagedResponse<ProductionEmployeeListItemDto>> GetPagedAsync(
            string callerUserName, bool isAdmin, int pageIndex, int pageSize, string? keyword,
            int? productionLineId, int? teamId, int? shiftTeamId, int? departmentId)
        {
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var trimmedKeyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();

            // Department coordinators only (not group). Rows without a resolved Employee have no scope and stay hidden from non-Admins.
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

        private static (int Year, int Month) GetTodayYearMonth()
        {
            var today = DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());
            return (today.Year, today.Month);
        }

        // Always store Id+Code from the selected entity so codes never drift from FKs. IsLeader is read live when
        // resolving the production approval chain, so no extra sync is needed.
        public async Task UpdateAsync(int id, UpdateProductionEmployeeDto request, string callerUserName, bool isAdmin)
        {
            var entity = (await _unitOfWork.ProductionEmployees.GetByIdAsync(id)).OrThrowNotFound("Nhân viên dưới chuyền", id);

            // Rows without a resolved Employee have no department, so non-Admins are always blocked.
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

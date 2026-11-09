using Attendance.Application.Dtos.AttendanceSettings;
using Attendance.Application.Dtos.ProductionEmployees;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Shared.Application.Helper;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Picks people on the production roster (employees with a Line) by Line/Team/shift/CongDoan for production forms.
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

            var filtered = _unitOfWork.Employees.GetQueryable().Where(x => !x.IsDeleted && x.ProductionLineId != null
                    && (productionLineId == null || x.ProductionLineId == productionLineId)
                    && (teamId == null || x.TeamId == teamId)
                    && (shiftTeamId == null || x.ShiftTeamId == shiftTeamId)
                    && (congDoan == null || x.CongDoan == congDoan)
                    && (trimmedKeyword == null
                        || x.Code.Contains(trimmedKeyword)
                        || x.LastName.Contains(trimmedKeyword)
                        || x.FirstName.Contains(trimmedKeyword)));
            var items = await _unitOfWork.Employees.ToListAsync(
                filtered.OrderBy(x => x.Code.Length).ThenBy(x => x.Code).Take(MaxSearchResults),
                selector: x => new ProductionEmployeeSearchItemDto
                {
                    EmployeeId = x.Id,
                    EmployeeCode = x.Code,
                    FullName = x.LastName + " " + x.FirstName,
                    CongDoan = x.CongDoan,
                    TaskName = x.TaskName,
                    BlockCode = x.ProductionLine != null ? x.ProductionLine.LineCode : null,
                    TeamCode = x.Team != null ? x.Team.Code : null,
                    ShiftTeamCode = x.ShiftTeam != null ? x.ShiftTeam.Code : null,
                    ShiftTeamNameVn = x.ShiftTeam != null ? x.ShiftTeam.NameVn : null,
                    IsLeader = x.JobTitle != null && x.JobTitle.IsLineScoped,
                    CustomMonthlyOtHourLimit = x.CustomMonthlyOtHourLimit,
                    CustomYearlyOtHourLimit = x.CustomYearlyOtHourLimit
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

            // ProductionLine.TeamId is a static snapshot while employees' teams change with each import, so derive the
            // Team->Line options from actual employees to avoid combos that return nothing.
            var items = await _unitOfWork.Employees.SelectAsync(
                predicate: x => !x.IsDeleted && x.ProductionLineId != null && x.TeamId == teamId,
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
            var items = await _unitOfWork.Employees.SelectAsync(
                predicate: x => !x.IsDeleted && x.ProductionLineId != null && x.ShiftTeamId != null
                    && (productionLineId == null || x.ProductionLineId == productionLineId)
                    && (teamId == null || x.TeamId == teamId),
                selector: x => new ProductionOptionDto { Id = x.ShiftTeamId!.Value, Code = x.ShiftTeam!.Code, NameVn = x.ShiftTeam!.NameVn });

            return items.DistinctBy(x => x.Id).OrderBy(x => x.Code.Length).ThenBy(x => x.Code).ToList();
        }

        public async Task<List<string>> GetCongDoanOptionsAsync()
        {
            var items = await _unitOfWork.Employees.SelectAsync(
                predicate: x => !x.IsDeleted && x.ProductionLineId != null && x.CongDoan != null,
                selector: x => x.CongDoan!);
            return items.Distinct(StringComparer.OrdinalIgnoreCase).Order(StringComparer.OrdinalIgnoreCase).ToList();
        }

        // Manual fix between imports; the next import overwrites it.
        public async Task UpdateAsync(int employeeId, UpdateProductionEmployeeDto request, string callerUserName, bool isAdmin)
        {
            var entity = (await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == employeeId && !x.IsDeleted, x => x.Group!))
                .OrThrowNotFound("Nhân viên", employeeId);

            if (!isAdmin)
            {
                var departmentId = entity!.DepartmentId ?? entity.Group?.DepartmentId;
                var managedDepartmentIds = await _departmentAccessGuard.GetManagedDepartmentIdsAsync(callerUserName);
                if (departmentId == null || !managedDepartmentIds.Contains(departmentId.Value))
                    throw new DomainException("Bạn chỉ được sửa nhân sự dưới chuyền thuộc Bộ phận mình phụ trách.");
            }

            if (request.ProductionLineId.HasValue)
                (await _unitOfWork.ProductionLines.GetByIdAsync(request.ProductionLineId.Value)).OrThrowNotFound("Line", request.ProductionLineId.Value);
            if (request.TeamId.HasValue)
                (await _unitOfWork.ProductionTeams.GetByIdAsync(request.TeamId.Value)).OrThrowNotFound("Team", request.TeamId.Value);
            if (request.ShiftTeamId.HasValue)
                (await _unitOfWork.ProductionShiftTeams.GetByIdAsync(request.ShiftTeamId.Value)).OrThrowNotFound("Nhóm ca", request.ShiftTeamId.Value);

            entity!.ProductionLineId = request.ProductionLineId;
            entity.TeamId = request.TeamId;
            entity.ShiftTeamId = request.ShiftTeamId;
            await _unitOfWork.SaveChangesAsync();
        }
    }
}

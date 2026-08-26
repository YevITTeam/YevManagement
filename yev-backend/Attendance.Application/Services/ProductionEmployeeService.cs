using Attendance.Application.Dtos.AttendanceSettings;
using Attendance.Application.Dtos.ProductionEmployees;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Shared.Application.Helper;
using Shared.Application.Services;

namespace Attendance.Application.Services
{
    // Phục vụ màn "Theo chuyền" khi tạo đơn OT (2026-08-24) — tìm người theo Line/Team/Nhóm
    // ca/CongDoan thay vì theo Group cố định (xem OtFormService.CreateProductionFormAsync). CHỈ trả
    // về người ĐÃ có EmployeeId (bảng ProductionEmployees vốn chỉ chứa dòng đã resolve đủ theo policy
    // nạp, xem ProductionEmployee.cs) — không cần lọc thêm ở đây.
    public class ProductionEmployeeService : BaseService<IAttendanceUnitOfWork>, IProductionEmployeeService
    {
        private readonly IAttendanceSettingService _attendanceSettingService;

        public ProductionEmployeeService(IAttendanceUnitOfWork unitOfWork, IAttendanceSettingService attendanceSettingService)
            : base(unitOfWork)
        {
            _attendanceSettingService = attendanceSettingService;
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

            var result = items.OrderBy(x => x.EmployeeCode).ToList();
            if (result.Count == 0) return result;

            var target = targetDate ?? DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());
            var mealSettings = await _attendanceSettingService.GetAsync();
            var employeeIds = result.Select(x => x.EmployeeId).ToList();

            var pendingRows = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => employeeIds.Contains(x.EmployeeId) && !x.IsRemoved && x.OtForm.Status != (int)OtFormStatus.Rejected
                     && !x.OtForm.IsDeleted && x.OtForm.Date.Year == target.Year,
                x => x.OtForm);

            var rowsByEmployee = pendingRows.GroupBy(x => x.EmployeeId).ToDictionary(g => g.Key, g => g.ToList());
            foreach (var item in result)
            {
                if (!rowsByEmployee.TryGetValue(item.EmployeeId, out var rows)) continue;
                item.ProjectedDayToDate = rows.Where(x => x.OtForm.Date == target)
                    .Sum(x => CalculateProjectedHours(x, mealSettings));
                item.ProjectedMonthToDate = rows.Where(x => x.OtForm.Date.Month == target.Month)
                    .Sum(x => CalculateProjectedHours(x, mealSettings));
                item.ProjectedYearToDate = rows.Sum(x => CalculateProjectedHours(x, mealSettings));
            }

            return result;
        }

        // Mirror EmployeeService.CalculateProjectedHours/OtFormService.CalculateOtHours — mỗi service tự
        // chứa logic tính giờ của mình, không gọi chéo (quy ước đã có từ redesign 3 bậc phiếu ăn 2026-08-26).
        private static decimal CalculateProjectedHours(OtFormEmployee row, AttendanceSettingDto mealSettings)
        {
            var hours = (decimal)(row.EndTime - row.StartTime).TotalHours;
            var isEarlyWindow = row.StartTime == mealSettings.EarlyMealWindowStartTime && row.EndTime == mealSettings.EarlyMealWindowEndTime;
            if (!isEarlyWindow && row.DidEat) hours -= mealSettings.MealBreakDeductionHours;
            return hours;
        }

        // teamId lọc Line theo đúng Team đã chọn — ProductionLine.TeamId là FK thật (xem ProductionLine.cs),
        // Team chứa Line CHỨ KHÔNG PHẢI ngược lại, nên chỉ Line mới cần tham số cascade này (2026-08-25).
        public async Task<List<ProductionOptionDto>> GetLineOptionsAsync(int? teamId)
        {
            var items = await _unitOfWork.ProductionLines.SelectAsync(
                predicate: x => !x.IsDeleted && (teamId == null || x.TeamId == teamId),
                selector: x => new ProductionOptionDto { Id = x.Id, Code = x.LineCode, NameVn = null });
            return items.OrderBy(x => x.Code).ToList();
        }

        public async Task<List<ProductionOptionDto>> GetTeamOptionsAsync()
        {
            var items = await _unitOfWork.ProductionTeams.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new ProductionOptionDto { Id = x.Id, Code = x.Code, NameVn = x.NameVn });
            return items.OrderBy(x => x.Code).ToList();
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

            return items.DistinctBy(x => x.Id).OrderBy(x => x.Code).ToList();
        }
    }
}

using Attendance.Application.Dtos.AttendanceSettings;
using Attendance.Application.Dtos.Departments;
using Attendance.Application.Dtos.Workshops;
using Attendance.Application.Dtos.EmployeeAccumulationHistories;
using Attendance.Application.Dtos.Employees;
using Attendance.Application.Dtos.Groups;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Constants;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class EmployeeService : BaseService<IAttendanceUnitOfWork>, IEmployeeService
    {
        private readonly IUserDirectoryService _userDirectoryService;
        private readonly IAttendanceSettingService _attendanceSettingService;
        private readonly IDepartmentAccessGuard _departmentAccessGuard;

        public EmployeeService(
            IAttendanceUnitOfWork unitOfWork, IUserDirectoryService userDirectoryService,
            IAttendanceSettingService attendanceSettingService, IDepartmentAccessGuard departmentAccessGuard)
            : base(unitOfWork)
        {
            _userDirectoryService = userDirectoryService;
            _attendanceSettingService = attendanceSettingService;
            _departmentAccessGuard = departmentAccessGuard;
        }

        // Lũy kế THẬT không còn lưu trên Employee (2026-08-19) — tính trực tiếp từ
        // EmployeeAccumulationHistory (ledger) ngay trong projection (EF dịch được thành subquery),
        // luôn scope theo năm/tháng THỰC TẾ hôm nay (không phải ngày trên bất kỳ đơn nào) — mỗi hàm đọc
        // bên dưới tự lấy `todayYear`/`todayMonth` qua GetTodayYearMonth() rồi lặp lại công thức
        // (không gộp thành 1 Expression dùng chung được vì EF không hỗ trợ Invoke composed expression).
        private static (int Year, int Month) GetTodayYearMonth()
        {
            var today = DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());
            return (today.Year, today.Month);
        }

        // Phạm vi xem nhân viên suy theo ĐÚNG vị trí Cây chức vụ của người gọi — dùng chung cho MỌI
        // endpoint trả danh sách nhân viên chỉ gate bằng Attendance.Employee.View (permission này cấp
        // TOÀN CÔNG TY qua JobTitlePermissionWhitelist, không tự scope), để 1 Staff bất kỳ không xem
        // được lũy kế/giới hạn OT của cả công ty (2026-09-03). Không áp dụng cho GetByDepartmentIdAsync/
        // GetByGroupIdAsync (nhận thẳng Id, dùng cho màn Cây duyệt/lập đơn — phạm vi đã do route quyết định).
        //   - TerminalLevel=WorkshopManager/GeneralDirector (Trưởng Xưởng/Giám đốc): toàn công ty.
        //   - Có DepartmentId (Manager): nhân viên có DepartmentId trùng, hoặc Group.DepartmentId trùng.
        //   - Còn lại (Staff/Group Leader/Team Leader, cấp Nhóm): chỉ nhân viên có GroupId trùng.
        // PairKeys = (Department, Workshop) pairs of a Manager (ScopeKey); GroupIds already holds every group
        // under a coordinated department or a managed pair, so group-based staff match through GroupIds only.
        private readonly record struct EmployeeScope(bool CompanyWide, HashSet<int> DepartmentIds, HashSet<int> GroupIds, HashSet<int> PairKeys);

        // Phạm vi XEM = hợp nhất vị trí THẬT trong Cây chức vụ (Manager có DepartmentId/Staff có GroupId)
        // VÀ mọi Bộ phận/Nhóm đang được gán làm "Người phụ trách" (Coordinator, gán tay qua Cây duyệt,
        // KHÔNG liên quan Chức vụ — xem §Chốt mô hình Coordinator, 2026-09-28). Trước đó 2 nguồn này lệch
        // nhau: 1 người được Admin gán Coordinator cho 1 Nhóm/Bộ phận KHÁC vị trí thật của mình thì có
        // quyền SỬA OT-limit/lũy kế/dưới chuyền của Nhóm/Bộ phận đó (đã cấp tự động), nhưng màn "Nhân
        // viên" (chỉ dùng vị trí thật) không hiện được người cần sửa — quyền cấp ra không dùng được.
        private async Task<EmployeeScope> ResolveCallerScopeAsync(string callerUserName)
        {
            var caller = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == callerUserName && !x.IsDeleted, x => x.JobTitle!);
            if (caller == null)
                throw new DomainException("Tài khoản của bạn chưa liên kết với hồ sơ Nhân viên nào.");

            var callerTerminalLevel = (JobTitleTerminalLevel)(caller.JobTitle?.TerminalLevel ?? (int)JobTitleTerminalLevel.None);
            if (callerTerminalLevel == JobTitleTerminalLevel.WorkshopManager || callerTerminalLevel == JobTitleTerminalLevel.GeneralDirector)
                return new EmployeeScope(true, new HashSet<int>(), new HashSet<int>(), new HashSet<int>());

            var departmentIds = await _departmentAccessGuard.GetManagedDepartmentIdsAsync(callerUserName);
            var groupIds = (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                    x => x.Employee.UserName == callerUserName && !x.IsDeleted))
                .Select(x => x.GroupId)
                .ToHashSet();

            var callerScopes = await _unitOfWork.EmployeeApprovalScopes.FindAsync(x => x.EmployeeId == caller.Id);
            var pairKeys = callerScopes.Select(x => ScopeKey.Of(x.DepartmentId, x.WorkshopId)).ToHashSet();
            if (caller.GroupId.HasValue) groupIds.Add(caller.GroupId.Value);

            if (departmentIds.Count == 0 && groupIds.Count == 0 && pairKeys.Count == 0)
                throw new DomainException("Tài khoản của bạn chưa được gán Nhóm/Bộ phận nào.");

            var expandDepartmentIds = departmentIds.Union(callerScopes.Select(x => x.DepartmentId)).ToList();
            if (expandDepartmentIds.Count > 0)
            {
                var childGroups = await _unitOfWork.Groups.SelectAsync(
                    x => !x.IsDeleted && expandDepartmentIds.Contains(x.DepartmentId),
                    x => new { x.Id, x.DepartmentId, x.WorkshopId });
                foreach (var g in childGroups)
                    if (departmentIds.Contains(g.DepartmentId) || pairKeys.Contains(ScopeKey.Of(g.DepartmentId, g.WorkshopId)))
                        groupIds.Add(g.Id);
            }

            return new EmployeeScope(false, departmentIds, groupIds, pairKeys);
        }

        private static IQueryable<Employee> ApplyScope(IQueryable<Employee> query, EmployeeScope scope)
        {
            if (scope.CompanyWide) return query;
            var departmentIds = scope.DepartmentIds;
            var groupIds = scope.GroupIds;
            var pairKeys = scope.PairKeys;
            return query.Where(x =>
                (x.GroupId != null && groupIds.Contains(x.GroupId.Value))
                || (x.DepartmentId != null && departmentIds.Contains(x.DepartmentId.Value))
                || x.ApprovalScopes.Any(s => departmentIds.Contains(s.DepartmentId) || pairKeys.Contains(s.DepartmentId * ScopeKey.Factor + s.WorkshopId)));
        }

        // Cho FE thu hẹp dropdown lọc Phòng ban/Nhóm ở màn "Nhân viên" — thuần UX, không phục vụ enforce
        // (đã enforce ở GetPagedAsync rồi). Trả ĐỦ danh sách Phòng ban/Nhóm trong
        // phạm vi (2026-09-28, sửa lỗi thật: bản cũ chỉ chứa được đúng 1 Phòng ban HOẶC 1 Nhóm, nên
        // người vừa có vị trí thật là Nhóm VỪA là Coordinator của 1 Phòng ban khác thì trả rỗng cả 2,
        // khiến dropdown Nhóm ở FE hiện "Không tìm thấy kết quả" dù bảng chính vẫn đúng dữ liệu) — FE
        // dùng thẳng, không cần gọi thêm DepartmentApi/GroupApi.
        public async Task<EmployeeScopeDto> GetMyScopeAsync(string callerUserName, bool isAdmin)
        {
            if (isAdmin) return new EmployeeScopeDto { CompanyWide = true };

            var scope = await ResolveCallerScopeAsync(callerUserName);
            if (scope.CompanyWide) return new EmployeeScopeDto { CompanyWide = true };

            var departmentIdsInScope = scope.DepartmentIds.Union(scope.PairKeys.Select(k => k / ScopeKey.Factor)).ToList();
            var departments = departmentIdsInScope.Count == 0
                ? new List<DepartmentDto>()
                : (await _unitOfWork.Departments.SelectAsync(
                    x => departmentIdsInScope.Contains(x.Id) && !x.IsDeleted,
                    x => new DepartmentDto { Id = x.Id, DepartmentCode = x.DepartmentCode, DepartmentNameVn = x.DepartmentNameVn, DepartmentNameJp = x.DepartmentNameJp }))
                    .ToList();

            // GroupIds is already expanded to every group under a coordinated department or managed pair.
            var groups = scope.GroupIds.Count == 0
                ? new List<GroupDto>()
                : (await _unitOfWork.Groups.SelectAsync(
                    x => !x.IsDeleted && scope.GroupIds.Contains(x.Id),
                    x => new GroupDto
                    {
                        Id = x.Id,
                        GroupCode = x.GroupCode,
                        GroupNameVn = x.GroupNameVn,
                        GroupNameJp = x.GroupNameJp,
                        DepartmentId = x.DepartmentId,
                        DepartmentNameVn = x.Department.DepartmentNameVn,
                        WorkshopId = x.WorkshopId,
                        WorkshopNameVn = x.Workshop.WorkshopNameVn
                    }))
                    .ToList();

            var workshopIds = groups.Select(g => g.WorkshopId).Union(scope.PairKeys.Select(k => k % ScopeKey.Factor)).ToList();
            var workshops = workshopIds.Count == 0
                ? new List<WorkshopDto>()
                : (await _unitOfWork.Workshops.SelectAsync(
                    x => workshopIds.Contains(x.Id) && !x.IsDeleted,
                    x => new WorkshopDto { Id = x.Id, WorkshopCode = x.WorkshopCode, WorkshopNameVn = x.WorkshopNameVn, WorkshopNameJp = x.WorkshopNameJp }))
                    .OrderBy(x => x.WorkshopCode)
                    .ToList();

            return new EmployeeScopeDto { Departments = departments, Groups = groups, Workshops = workshops };
        }

        public async Task<PagedResponse<EmployeeDto>> GetPagedAsync(
            string callerUserName, bool isAdmin, int pageIndex, int pageSize, string? keyword, int? departmentId, int? groupId, int? workshopId)
        {
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var query = _unitOfWork.Employees.GetQueryable(false, x => x.Group!, x => x.Department!, x => x.JobTitle!).Where(x => !x.IsDeleted);

            if (!isAdmin)
                query = ApplyScope(query, await ResolveCallerScopeAsync(callerUserName));

            // Khớp cả 2 đường tới Department: trực tiếp (Trưởng phòng, xem Employee.DepartmentId) hoặc
            // qua Group (nhân viên thường) — Trưởng Xưởng/Giám đốc (cả GroupId lẫn DepartmentId đều
            // null, dùng chung toàn công ty) sẽ không khớp bộ lọc theo Phòng ban nào cả, đúng ý nghĩa.
            if (departmentId.HasValue)
                query = query.Where(x => x.ApprovalScopes.Any(s => s.DepartmentId == departmentId.Value) || (x.Group != null && x.Group.DepartmentId == departmentId.Value));
            if (workshopId.HasValue)
                query = query.Where(x => x.ApprovalScopes.Any(s => s.WorkshopId == workshopId.Value) || (x.Group != null && x.Group.WorkshopId == workshopId.Value));
            if (groupId.HasValue)
                query = query.Where(x => x.GroupId == groupId.Value);

            var orderedQuery = query.OrderBy(x => x.Code.Length).ThenBy(x => x.Code);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                // "Họ và tên" hiển thị theo quy ước "{LastName} {FirstName}" (giống OtFormService) —
                // so khớp cả chuỗi ghép để tìm được khi người dùng gõ đủ họ tên, không chỉ từng phần riêng lẻ.
                query = query.Where(x =>
                    x.Code.Contains(keyword) ||
                    x.FirstName.Contains(keyword) ||
                    x.LastName.Contains(keyword) ||
                    (x.LastName + " " + x.FirstName).Contains(keyword));

                // Khớp đúng tuyệt đối Code (vd tìm "50" ra ngay mã "50") được ưu tiên lên đầu,
                // thay vì lẫn giữa các mã chỉ chứa keyword (vd "150", "250", "500").
                orderedQuery = query.OrderBy(x => x.Code == keyword ? 0 : 1).ThenBy(x => x.Code.Length).ThenBy(x => x.Code);
            }

            return await _unitOfWork.Employees.ToPagedResponseAsync(
                orderedQuery,
                pageIndex,
                pageSize,
                x => new EmployeeDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    FirstName = x.FirstName,
                    LastName = x.LastName,
                    UserName = x.UserName,
                    MonthToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month == todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    YearToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month <= todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    GroupId = x.GroupId,
                    GroupNameVn = x.Group != null ? x.Group.GroupNameVn : null,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department != null ? x.Department.DepartmentNameVn : null,
                    JobTitleId = x.JobTitleId,
                    JobTitleName = x.JobTitle != null ? x.JobTitle.Name : null,
                    WorkshopId = x.Group != null ? x.Group.WorkshopId : (int?)null,
                    WorkshopNameVn = x.Group != null ? x.Group.Workshop.WorkshopNameVn : null,
                    ApprovalScopes = x.ApprovalScopes.Select(s => new EmployeeApprovalScopeDto
                    {
                        WorkshopId = s.WorkshopId,
                        WorkshopNameVn = s.Workshop.WorkshopNameVn,
                        DepartmentId = s.DepartmentId,
                        DepartmentNameVn = s.Department.DepartmentNameVn
                    }).ToList(),
                    CustomMonthlyOtHourLimit = x.CustomMonthlyOtHourLimit,
                    CustomYearlyOtHourLimit = x.CustomYearlyOtHourLimit
                }
            );
        }

        // Toàn bộ nhân viên active (mọi Group) — dùng cho các dropdown/công cụ cần chọn 1 nhân viên bất
        // kỳ, vd JobTitle "Thử chuỗi duyệt" (docs/docs-be/attendance-module.md §Cây chức vụ). Non-Admin
        // tự giới hạn theo phạm vi Cây chức vụ của người gọi, cùng lý do với GetPagedAsync.
        // Dùng cho Trưởng nhóm liệt kê/chọn hàng loạt nhân viên nhóm mình khi lập OtForm. Trưởng
        // phòng/Trưởng Xưởng/Giám đốc (GroupId null) không bao giờ khớp — đúng ý nghĩa, họ không phải
        // thành viên của 1 Group cụ thể nào để bị liệt kê ở đây.
        // targetDate = ngày trên đơn OT ĐANG TẠO (mặc định hôm nay thực tế nếu FE chưa chọn ngày) —
        // Projected CHỈ có ý nghĩa scope theo đúng tháng/năm của targetDate, KHÁC HẲN MonthToDate/
        // YearToDate thật ở trên (luôn theo hôm nay thực tế) — xem docs/docs-be/attendance-module.md
        // §Lũy kế Dự kiến. Ví dụ: đang tạo đơn cho ngày 1/8 dù hôm nay 27/7 thì phải thấy Dự kiến của
        // đúng tháng 8, không phải tháng 7.
        public async Task<List<EmployeeDto>> GetByGroupIdAsync(int groupId, DateOnly? targetDate = null)
        {
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var items = await _unitOfWork.Employees.SelectAsync(
                predicate: x => !x.IsDeleted && x.GroupId == groupId,
                selector: x => new EmployeeDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    FirstName = x.FirstName,
                    LastName = x.LastName,
                    UserName = x.UserName,
                    MonthToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month == todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    YearToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month <= todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    GroupId = x.GroupId,
                    GroupNameVn = x.Group != null ? x.Group.GroupNameVn : null,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department != null ? x.Department.DepartmentNameVn : null,
                    JobTitleId = x.JobTitleId,
                    JobTitleName = x.JobTitle != null ? x.JobTitle.Name : null,
                    WorkshopId = x.Group != null ? x.Group.WorkshopId : (int?)null,
                    WorkshopNameVn = x.Group != null ? x.Group.Workshop.WorkshopNameVn : null,
                    ApprovalScopes = x.ApprovalScopes.Select(s => new EmployeeApprovalScopeDto
                    {
                        WorkshopId = s.WorkshopId,
                        WorkshopNameVn = s.Workshop.WorkshopNameVn,
                        DepartmentId = s.DepartmentId,
                        DepartmentNameVn = s.Department.DepartmentNameVn
                    }).ToList(),
                    CustomMonthlyOtHourLimit = x.CustomMonthlyOtHourLimit,
                    CustomYearlyOtHourLimit = x.CustomYearlyOtHourLimit
                }
            );

            var target = targetDate ?? DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());
            var employeeIds = items.Select(x => x.Id).ToList();
            if (employeeIds.Count > 0)
            {
                var mealSettings = await _attendanceSettingService.GetAsync();

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
                foreach (var item in items)
                {
                    var employeeRows = rowsByEmployee[item.Id].ToList();
                    var pendingRows = employeeRows.Where(x => x.OtForm.Status != (int)OtFormStatus.Completed).ToList();
                    var ledger = ledgerByEmployee[item.Id].ToList();

                    item.ProjectedDayToDate = employeeRows.Where(x => x.OtForm.Date == target)
                        .Sum(x => CalculateProjectedHours(x, mealSettings));
                    item.ProjectedMonthToDate = ledger.Where(x => x.Month == target.Month).Sum(x => x.TotalHours)
                        + pendingRows.Where(x => x.OtForm.Date.Month == target.Month).Sum(x => CalculateProjectedHours(x, mealSettings));
                    item.ProjectedYearToDate = ledger.Sum(x => x.TotalHours)
                        + pendingRows.Sum(x => CalculateProjectedHours(x, mealSettings));
                }
            }

            return items.OrderBy(x => x.Code.Length).ThenBy(x => x.Code).ToList();
        }

        // Mirror OtFormService.CalculateOtHours (redesign 3 bậc phiếu ăn 2026-08-26, xem
        // AttendanceSetting.cs) — không gọi chéo sang OtFormService, mỗi service tự chứa logic tính
        // giờ của mình. Ca khớp ĐÚNG khung sớm (EarlyMealWindowStartTime/EndTime) không trừ dù DidEat.
        private static decimal CalculateProjectedHours(OtFormEmployee row, AttendanceSettingDto mealSettings)
        {
            var hours = Math.Round((decimal)(row.EndTime - row.StartTime).TotalHours, 2);
            var isEarlyWindow = row.StartTime == mealSettings.EarlyMealWindowStartTime && row.EndTime == mealSettings.EarlyMealWindowEndTime;
            if (!isEarlyWindow && row.DidEat) hours -= mealSettings.MealBreakDeductionHours;
            return hours;
        }

        // Toàn bộ nhân viên active thuộc Phòng ban (mọi Group con, CỘNG Trưởng phòng gán trực tiếp
        // DepartmentId) — dùng cho màn "Cây duyệt Phòng ban" (xem ai đang giữ Chức vụ nào trong Phòng
        // ban để cấu hình/gán nhanh — docs/attendance-module.md §Cây chức vụ).
        // A department can hold thousands of employees, so the result is always capped (MaxDepartmentListSize);
        // callers narrow it with keyword / jobTitled (only employees that hold a Job Title) / take.
        private const int MaxDepartmentListSize = 500;

        public async Task<List<EmployeeDto>> GetByDepartmentIdAsync(
            int departmentId, int? workshopId = null, string? keyword = null, bool jobTitledOnly = false, int? take = null)
        {
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var trimmedKeyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();
            var limit = Math.Clamp(take ?? MaxDepartmentListSize, 1, MaxDepartmentListSize);

            var query = _unitOfWork.Employees.GetQueryable().Where(x => !x.IsDeleted
                && (x.ApprovalScopes.Any(s => s.DepartmentId == departmentId && (workshopId == null || s.WorkshopId == workshopId))
                    || (x.Group != null && x.Group.DepartmentId == departmentId && (workshopId == null || x.Group.WorkshopId == workshopId))));
            if (jobTitledOnly)
                query = query.Where(x => x.JobTitleId != null);
            if (trimmedKeyword != null)
                query = query.Where(x => x.Code.Contains(trimmedKeyword) || x.LastName.Contains(trimmedKeyword) || x.FirstName.Contains(trimmedKeyword));

            return await _unitOfWork.Employees.ToListAsync(
                query.OrderBy(x => x.Code.Length).ThenBy(x => x.Code).Take(limit),
                selector: x => new EmployeeDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    FirstName = x.FirstName,
                    LastName = x.LastName,
                    UserName = x.UserName,
                    MonthToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month == todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    YearToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month <= todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    GroupId = x.GroupId,
                    GroupNameVn = x.Group != null ? x.Group.GroupNameVn : null,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department != null ? x.Department.DepartmentNameVn : null,
                    JobTitleId = x.JobTitleId,
                    JobTitleName = x.JobTitle != null ? x.JobTitle.Name : null,
                    WorkshopId = x.Group != null ? x.Group.WorkshopId : (int?)null,
                    WorkshopNameVn = x.Group != null ? x.Group.Workshop.WorkshopNameVn : null,
                    ApprovalScopes = x.ApprovalScopes.Select(s => new EmployeeApprovalScopeDto
                    {
                        WorkshopId = s.WorkshopId,
                        WorkshopNameVn = s.Workshop.WorkshopNameVn,
                        DepartmentId = s.DepartmentId,
                        DepartmentNameVn = s.Department.DepartmentNameVn
                    }).ToList(),
                    CustomMonthlyOtHourLimit = x.CustomMonthlyOtHourLimit,
                    CustomYearlyOtHourLimit = x.CustomYearlyOtHourLimit
                });
        }

        // Nhân viên trong phạm vi quản lý của người GIỮ QUYỀN DUYỆT (Attendance.OTForm.Approve, không
        // nhất thiết có Attendance.Employee.View) — dùng cho màn "Lũy kế nhân viên" tra cứu (2026-08-11d,
        // xem docs/docs-be/attendance-module.md §Lịch sử lũy kế). Phạm vi suy theo ĐÚNG vị trí Cây chức
        // vụ của người gọi (KHÁC bảng Người phụ trách Cây duyệt — đó là uỷ quyền cấu hình cây duyệt,
        // còn đây là phạm vi xem/duyệt theo đúng cấp bậc thật họ đang giữ):
        //   - Admin: không giới hạn.
        //   - TerminalLevel=WorkshopManager/GeneralDirector (Trưởng Xưởng/Giám đốc): toàn công ty.
        //   - Có DepartmentId (Manager): nhân viên có DepartmentId trùng, hoặc Group.DepartmentId trùng.
        //   - Còn lại (Staff/Group Leader/Team Leader, cấp Nhóm): chỉ nhân viên có GroupId trùng.
        public async Task<PagedResponse<EmployeeDto>> GetInScopeAsync(string callerUserName, bool isAdmin, int pageIndex, int pageSize, string? keyword)
        {
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var query = _unitOfWork.Employees.GetQueryable(false, x => x.Group!, x => x.Department!, x => x.JobTitle!).Where(x => !x.IsDeleted);

            if (!isAdmin)
                query = ApplyScope(query, await ResolveCallerScopeAsync(callerUserName));

            var orderedQuery = query.OrderBy(x => x.Code.Length).ThenBy(x => x.Code);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x =>
                    x.Code.Contains(keyword) ||
                    x.FirstName.Contains(keyword) ||
                    x.LastName.Contains(keyword) ||
                    (x.LastName + " " + x.FirstName).Contains(keyword));
                orderedQuery = query.OrderBy(x => x.Code == keyword ? 0 : 1).ThenBy(x => x.Code.Length).ThenBy(x => x.Code);
            }

            return await _unitOfWork.Employees.ToPagedResponseAsync(
                orderedQuery,
                pageIndex,
                pageSize,
                x => new EmployeeDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    FirstName = x.FirstName,
                    LastName = x.LastName,
                    UserName = x.UserName,
                    MonthToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month == todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    YearToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month <= todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    GroupId = x.GroupId,
                    GroupNameVn = x.Group != null ? x.Group.GroupNameVn : null,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department != null ? x.Department.DepartmentNameVn : null,
                    JobTitleId = x.JobTitleId,
                    JobTitleName = x.JobTitle != null ? x.JobTitle.Name : null,
                    WorkshopId = x.Group != null ? x.Group.WorkshopId : (int?)null,
                    WorkshopNameVn = x.Group != null ? x.Group.Workshop.WorkshopNameVn : null,
                    ApprovalScopes = x.ApprovalScopes.Select(s => new EmployeeApprovalScopeDto
                    {
                        WorkshopId = s.WorkshopId,
                        WorkshopNameVn = s.Workshop.WorkshopNameVn,
                        DepartmentId = s.DepartmentId,
                        DepartmentNameVn = s.Department.DepartmentNameVn
                    }).ToList(),
                    CustomMonthlyOtHourLimit = x.CustomMonthlyOtHourLimit,
                    CustomYearlyOtHourLimit = x.CustomYearlyOtHourLimit
                }
            );
        }

        // Lịch sử lũy kế 12 tháng của 1 năm cho 1 Employee — đọc từ EmployeeAccumulationHistory (ledger
        // append-only, ghi dần từ 2026-08-11d, KHÔNG có dữ liệu trước đó). Cùng phạm vi truy cập với
        // GetInScopeAsync (EnsureInAccumulationScopeAsync dùng chung logic suy phạm vi theo Cây chức vụ).
        public async Task<EmployeeAccumulationHistoryYearDto> GetAccumulationHistoryAsync(string callerUserName, bool isAdmin, int employeeId, int year)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(employeeId);
            employee.OrThrowNotFound("Nhân viên", employeeId);

            if (!isAdmin)
                await EnsureInAccumulationScopeAsync(callerUserName, employee!);

            return await BuildAccumulationYearDtoAsync(employee!, year);
        }

        // Cùng dữ liệu với GetAccumulationHistoryAsync nhưng cho người được quyền SỬA lũy kế (Admin /
        // Người phụ trách đúng Bộ phận/Nhóm của nhân viên) — không đòi Attendance.OTForm.Approve.
        public async Task<EmployeeAccumulationHistoryYearDto> GetAccumulationHistoryForManageAsync(string callerUserName, bool isAdmin, int employeeId, int year)
        {
            var employee = (await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == employeeId && !x.IsDeleted, x => x.Group!))
                .OrThrowNotFound("Nhân viên", employeeId);
            await EnsureCanManageDeptOrGroupScopeAsync(callerUserName, isAdmin, employee,
                "Bạn chỉ được sửa lũy kế của nhân viên thuộc Bộ phận/Nhóm mình phụ trách.");
            return await BuildAccumulationYearDtoAsync(employee, year);
        }

        public async Task<bool> CanViewOverviewAsync(string callerUserName, bool isAdmin)
        {
            if (isAdmin) return true;

            var caller = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == callerUserName && !x.IsDeleted, x => x.JobTitle!);
            return caller?.JobTitle != null && caller.JobTitle.TerminalLevel != (int)JobTitleTerminalLevel.None;
        }

        public async Task<IQueryable<Employee>> GetOverviewEmployeeQueryAsync(string callerUserName, bool isAdmin, int? workshopId)
        {
            var query = _unitOfWork.Employees.GetQueryable().Where(x => !x.IsDeleted);

            if (!isAdmin)
                query = ApplyScope(query, await ResolveCallerScopeAsync(callerUserName));
            if (workshopId.HasValue)
                query = query.Where(x => x.ApprovalScopes.Any(s => s.WorkshopId == workshopId.Value) || (x.Group != null && x.Group.WorkshopId == workshopId.Value));

            return query;
        }

        public async Task<List<EmployeeAccumulationDayDto>> GetAccumulationDaysAsync(string callerUserName, bool isAdmin, int employeeId, int year, int month)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(employeeId);
            employee.OrThrowNotFound("Nhân viên", employeeId);

            if (!isAdmin)
                await EnsureInAccumulationScopeAsync(callerUserName, employee!);

            return await BuildAccumulationDaysAsync(employeeId, year, month);
        }

        public async Task<List<EmployeeAccumulationDayDto>> GetAccumulationDaysForManageAsync(string callerUserName, bool isAdmin, int employeeId, int year, int month)
        {
            var employee = (await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == employeeId && !x.IsDeleted, x => x.Group!))
                .OrThrowNotFound("Nhân viên", employeeId);
            await EnsureCanManageDeptOrGroupScopeAsync(callerUserName, isAdmin, employee,
                "Bạn chỉ được xem lũy kế của nhân viên thuộc Bộ phận/Nhóm mình phụ trách.");
            return await BuildAccumulationDaysAsync(employeeId, year, month);
        }

        // Same rows and hour formula as the ledger feed (Completed forms), so imported/hand-edited hours have no day.
        private async Task<List<EmployeeAccumulationDayDto>> BuildAccumulationDaysAsync(int employeeId, int year, int month)
        {
            if (month < 1 || month > 12)
                throw new DomainException("Tháng phải từ 1 đến 12.");

            var settings = await _attendanceSettingService.GetAsync();
            var rows = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => x.EmployeeId == employeeId && !x.IsRemoved && !x.OtForm.IsDeleted
                     && x.OtForm.Status == (int)OtFormStatus.Completed
                     && x.OtForm.Date.Year == year && x.OtForm.Date.Month == month,
                x => x.OtForm);

            return rows
                .GroupBy(x => x.OtForm.Date)
                .OrderBy(g => g.Key)
                .Select(g => new EmployeeAccumulationDayDto
                {
                    Date = g.Key,
                    Hours = g.Sum(x => MealTicketCalculator.CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, settings))
                })
                .ToList();
        }

        // Đặt lại số giờ từng tháng + số dư đầu kỳ (Month = 0) của 1 năm. Không bắt lý do, không ghi log
        // (đã chốt: chỉ người có quyền mới vào được). Dòng chưa có mà giá trị 0 thì không tạo mới.
        public async Task<EmployeeAccumulationHistoryYearDto> UpdateAccumulationHistoryAsync(
            string callerUserName, bool isAdmin, int employeeId, UpdateEmployeeAccumulationDto request)
        {
            var employee = (await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == employeeId && !x.IsDeleted, x => x.Group!))
                .OrThrowNotFound("Nhân viên", employeeId);
            await EnsureCanManageDeptOrGroupScopeAsync(callerUserName, isAdmin, employee,
                "Bạn chỉ được sửa lũy kế của nhân viên thuộc Bộ phận/Nhóm mình phụ trách.");

            var hoursByMonth = new Dictionary<int, decimal> { [0] = request.InitialBalanceHours };
            foreach (var m in request.Months)
            {
                if (m.Month < 1 || m.Month > 12)
                    throw new DomainException("Tháng phải từ 1 đến 12.");
                if (m.TotalHours < 0)
                    throw new DomainException("Số giờ không được âm.");
                hoursByMonth[m.Month] = Math.Round(m.TotalHours, 2);
            }
            hoursByMonth[0] = Math.Round(request.InitialBalanceHours, 2);

            var existing = await _unitOfWork.EmployeeAccumulationHistories.FindAsync(x => x.EmployeeId == employeeId && x.Year == request.Year);
            foreach (var (month, hours) in hoursByMonth)
            {
                var row = existing.FirstOrDefault(x => x.Month == month);
                if (row != null)
                {
                    row.TotalHours = hours;
                    _unitOfWork.EmployeeAccumulationHistories.Update(row);
                }
                else if (hours != 0)
                {
                    await _unitOfWork.EmployeeAccumulationHistories.AddAsync(new EmployeeAccumulationHistory
                    {
                        EmployeeId = employeeId,
                        Year = request.Year,
                        Month = month,
                        TotalHours = hours
                    });
                }
            }
            await _unitOfWork.SaveChangesAsync();

            return await BuildAccumulationYearDtoAsync(employee, request.Year);
        }

        // Admin: luôn được. Người khác: phải là Người phụ trách (Admin gán tay) đúng Bộ phận chứa nhân
        // viên, hoặc đúng Nhóm của nhân viên — Người phụ trách Nhóm chỉ đụng được nhân viên trong Nhóm đó.
        // Dùng chung cho mọi thao tác "sửa 1 Employee cụ thể" mà quyền được cấp theo Người phụ trách
        // (lũy kế, giới hạn OT): phụ trách Phòng ban → sửa được cả phòng; chỉ phụ trách Nhóm → chỉ sửa
        // được đúng Nhóm đó. Admin luôn qua (2026-09-28, theo yêu cầu người dùng — Attendance.Employee.
        // UpdateOtLimit trước đây chỉ scope theo Phòng ban qua IDepartmentAccessGuard, không cho Người
        // phụ trách Nhóm dùng được dù đã được cấp quyền).
        private async Task EnsureCanManageDeptOrGroupScopeAsync(string callerUserName, bool isAdmin, Employee employee, string errorMessage)
        {
            if (isAdmin) return;

            var departmentId = employee.DepartmentId ?? employee.Group?.DepartmentId;
            if (departmentId.HasValue && (await _departmentAccessGuard.GetManagedDepartmentIdsAsync(callerUserName)).Contains(departmentId.Value))
                return;

            if (employee.GroupId.HasValue)
            {
                var groupId = employee.GroupId.Value;
                var isGroupCoordinator = (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                    x => x.GroupId == groupId && x.Employee.UserName == callerUserName && !x.IsDeleted)).Count > 0;
                if (isGroupCoordinator) return;
            }

            throw new DomainException(errorMessage);
        }

        // Biến thể của EnsureCanManageDeptOrGroupScopeAsync ở trên, dùng cho Create/Update khi CHƯA có
        // sẵn Employee entity để đọc GroupId/DepartmentId — nhận thẳng cặp (groupId, departmentId) ĐÃ
        // được ValidateOrganizationAssignmentAsync resolve xong (2026-09-28, theo yêu cầu người dùng:
        // Coordinator được cấp quyền Create/Update/Delete y hệt Admin nhưng chỉ trong đúng phạm vi).
        // Cả 2 field null (Trưởng Xưởng/Giám đốc, dùng chung toàn công ty) luôn NGOÀI phạm vi Coordinator
        // bất kỳ — chỉ Admin mới gán được vai trò này.
        private async Task EnsureAssignmentInCallerScopeAsync(
            string callerUserName, bool isAdmin, int? groupId, int? departmentId, List<(int WorkshopId, int DepartmentId)> scopes, string errorMessage)
        {
            if (isAdmin) return;

            // A manager's pairs must all sit inside departments the caller coordinates.
            if (scopes.Count > 0)
            {
                var coordinated = await _departmentAccessGuard.GetManagedDepartmentIdsAsync(callerUserName);
                if (scopes.All(x => coordinated.Contains(x.DepartmentId))) return;
                throw new DomainException(errorMessage);
            }

            if (!groupId.HasValue && !departmentId.HasValue)
                throw new DomainException(errorMessage);

            var managedDepartmentIds = await _departmentAccessGuard.GetManagedDepartmentIdsAsync(callerUserName);

            if (departmentId.HasValue)
            {
                if (managedDepartmentIds.Contains(departmentId.Value)) return;
                throw new DomainException(errorMessage);
            }

            var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == groupId!.Value && !x.IsDeleted);
            if (group != null && managedDepartmentIds.Contains(group.DepartmentId)) return;

            var isGroupCoordinator = (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                x => x.GroupId == groupId!.Value && x.Employee.UserName == callerUserName && !x.IsDeleted)).Count > 0;
            if (isGroupCoordinator) return;

            throw new DomainException(errorMessage);
        }

        private async Task<EmployeeAccumulationHistoryYearDto> BuildAccumulationYearDtoAsync(Employee employee, int year)
        {
            var employeeId = employee.Id;
            var rows = await _unitOfWork.EmployeeAccumulationHistories.FindAsync(x => x.EmployeeId == employeeId && x.Year == year);
            var hoursByMonth = rows.ToDictionary(x => x.Month, x => x.TotalHours);

            var initialBalance = hoursByMonth.GetValueOrDefault(0, 0m);
            var months = new List<EmployeeAccumulationHistoryDto>();
            decimal yearTotal = initialBalance;
            for (var month = 1; month <= 12; month++)
            {
                var hours = hoursByMonth.GetValueOrDefault(month, 0m);
                months.Add(new EmployeeAccumulationHistoryDto { Month = month, TotalHours = hours });
                yearTotal += hours;
            }

            return new EmployeeAccumulationHistoryYearDto
            {
                EmployeeId = employee.Id,
                EmployeeCode = employee.Code,
                EmployeeFullName = $"{employee.LastName} {employee.FirstName}",
                Year = year,
                Months = months,
                InitialBalanceHours = initialBalance,
                YearTotalHours = yearTotal
            };
        }

        // Mirror logic phạm vi ở GetInScopeAsync nhưng cho ĐÚNG 1 Employee mục tiêu (đã biết trước) —
        // tách riêng vì GetInScopeAsync lọc cả danh sách qua IQueryable, còn ở đây chỉ cần so trực tiếp.
        private async Task EnsureInAccumulationScopeAsync(string callerUserName, Employee targetEmployee)
        {
            var caller = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == callerUserName && !x.IsDeleted, x => x.JobTitle!);
            if (caller == null)
                throw new DomainException("Tài khoản của bạn chưa liên kết với hồ sơ Nhân viên nào.");

            var callerTerminalLevel = (JobTitleTerminalLevel)(caller.JobTitle?.TerminalLevel ?? (int)JobTitleTerminalLevel.None);
            if (callerTerminalLevel == JobTitleTerminalLevel.WorkshopManager || callerTerminalLevel == JobTitleTerminalLevel.GeneralDirector)
                return;

            var callerScopes = await _unitOfWork.EmployeeApprovalScopes.FindAsync(x => x.EmployeeId == caller.Id);
            if (callerScopes.Count > 0)
            {
                var callerKeys = callerScopes.Select(x => ScopeKey.Of(x.DepartmentId, x.WorkshopId)).ToHashSet();
                var targetKeys = (await _unitOfWork.EmployeeApprovalScopes.FindAsync(x => x.EmployeeId == targetEmployee.Id))
                    .Select(x => ScopeKey.Of(x.DepartmentId, x.WorkshopId)).ToHashSet();
                if (targetEmployee.GroupId.HasValue)
                {
                    var targetGroup = await _unitOfWork.Groups.GetByIdAsync(targetEmployee.GroupId.Value);
                    if (targetGroup != null) targetKeys.Add(ScopeKey.Of(targetGroup.DepartmentId, targetGroup.WorkshopId));
                }
                if (targetKeys.Overlaps(callerKeys)) return;
                throw new DomainException("Bạn chỉ được xem lũy kế của nhân viên thuộc Bộ phận mình quản lý.");
            }

            if (caller.GroupId.HasValue && targetEmployee.GroupId == caller.GroupId) return;

            throw new DomainException("Bạn chỉ được xem lũy kế của nhân viên thuộc Nhóm mình quản lý.");
        }

        // Lũy kế THẬT của 1 Employee, tính từ ledger, scope theo năm/tháng THỰC TẾ hôm nay — dùng cho
        // GetByIdAsync/GetByUserNameAsync (chỉ 1 người nên query trực tiếp, không cần EF dịch subquery
        // như các hàm liệt kê nhiều dòng ở trên).
        private async Task<(decimal MonthToDate, decimal YearToDate)> GetRealAccumulationAsync(int employeeId)
        {
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var rows = await _unitOfWork.EmployeeAccumulationHistories.FindAsync(
                x => x.EmployeeId == employeeId && x.Year == todayYear && x.Month <= todayMonth);
            return (rows.Where(x => x.Month == todayMonth).Sum(x => x.TotalHours), rows.Sum(x => x.TotalHours));
        }

        // Single-employee reads load the workshop/scopes separately; list reads project them inline.
        private async Task FillWorkshopInfoAsync(EmployeeDto dto)
        {
            if (dto.GroupId.HasValue)
            {
                var groupId = dto.GroupId.Value;
                var info = (await _unitOfWork.Groups.SelectAsync(x => x.Id == groupId, x => new { x.WorkshopId, x.Workshop.WorkshopNameVn })).FirstOrDefault();
                dto.WorkshopId = info?.WorkshopId;
                dto.WorkshopNameVn = info?.WorkshopNameVn;
            }

            dto.ApprovalScopes = (await _unitOfWork.EmployeeApprovalScopes.SelectAsync(
                x => x.EmployeeId == dto.Id,
                x => new EmployeeApprovalScopeDto
                {
                    WorkshopId = x.WorkshopId,
                    WorkshopNameVn = x.Workshop.WorkshopNameVn,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department.DepartmentNameVn
                })).ToList();
        }

        public async Task<EmployeeDto> GetByIdAsync(int id)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, x => x.Group!, x => x.Department!, x => x.JobTitle!);
            employee.OrThrowNotFound("Nhân viên", id);

            var (monthToDate, yearToDate) = await GetRealAccumulationAsync(id);

            var dto = new EmployeeDto
            {
                Id = employee!.Id,
                Code = employee.Code,
                FirstName = employee.FirstName,
                LastName = employee.LastName,
                UserName = employee.UserName,
                MonthToDate = monthToDate,
                YearToDate = yearToDate,
                GroupId = employee.GroupId,
                GroupNameVn = employee.Group?.GroupNameVn,
                DepartmentId = employee.DepartmentId,
                DepartmentNameVn = employee.Department?.DepartmentNameVn,
                JobTitleId = employee.JobTitleId,
                JobTitleName = employee.JobTitle?.Name,
                CustomMonthlyOtHourLimit = employee.CustomMonthlyOtHourLimit,
                CustomYearlyOtHourLimit = employee.CustomYearlyOtHourLimit
            };
            await FillWorkshopInfoAsync(dto);
            return dto;
        }

        // Nhân viên tự tra employeeId của chính mình (màn "Lũy kế của tôi") — so khớp Employee.UserName.
        public async Task<EmployeeDto> GetByUserNameAsync(string userName)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == userName && !x.IsDeleted, x => x.Group!, x => x.Department!, x => x.JobTitle!);
            employee.OrThrowNotFound("Nhân viên (tài khoản chưa được gán cho nhân viên nào)", userName);

            var (monthToDate, yearToDate) = await GetRealAccumulationAsync(employee!.Id);

            var dto = new EmployeeDto
            {
                Id = employee!.Id,
                Code = employee.Code,
                FirstName = employee.FirstName,
                LastName = employee.LastName,
                UserName = employee.UserName,
                MonthToDate = monthToDate,
                YearToDate = yearToDate,
                GroupId = employee.GroupId,
                GroupNameVn = employee.Group?.GroupNameVn,
                DepartmentId = employee.DepartmentId,
                DepartmentNameVn = employee.Department?.DepartmentNameVn,
                JobTitleId = employee.JobTitleId,
                JobTitleName = employee.JobTitle?.Name,
                CustomMonthlyOtHourLimit = employee.CustomMonthlyOtHourLimit,
                CustomYearlyOtHourLimit = employee.CustomYearlyOtHourLimit
            };
            await FillWorkshopInfoAsync(dto);
            return dto;
        }

        public async Task<EmployeeDto> CreateAsync(string callerUserName, bool isAdmin, CreateEmployeeDto request)
        {
            var exists = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Code == request.Code && !x.IsDeleted);
            if (exists != null) throw new DomainException($"Mã nhân viên '{request.Code}' đã tồn tại.");

            if (!string.IsNullOrWhiteSpace(request.UserName))
            {
                var existsUserName = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == request.UserName && !x.IsDeleted);
                if (existsUserName != null) throw new DomainException($"Tài khoản '{request.UserName}' đã được gán cho nhân viên khác.");
            }

            var (groupId, departmentId, scopes) = await ValidateOrganizationAssignmentAsync(request.JobTitleId, request.GroupId, request.DepartmentId, request.ApprovalScopes);
            await EnsureAssignmentInCallerScopeAsync(callerUserName, isAdmin, groupId, departmentId, scopes,
                "Bạn chỉ được tạo nhân viên thuộc Bộ phận/Nhóm mình phụ trách.");

            var newEmployee = new Employee
            {
                Code = request.Code,
                FirstName = request.FirstName,
                LastName = request.LastName,
                UserName = request.UserName,
                GroupId = groupId,
                DepartmentId = departmentId,
                JobTitleId = request.JobTitleId,
                CustomMonthlyOtHourLimit = request.CustomMonthlyOtHourLimit,
                CustomYearlyOtHourLimit = request.CustomYearlyOtHourLimit,
                IsDeleted = false
            };

            await _unitOfWork.Employees.AddAsync(newEmployee);
            await _unitOfWork.SaveChangesAsync();
            await ReplaceApprovalScopesAsync(newEmployee.Id, scopes);

            await SyncAutoGrantedPermissionsCoreAsync(newEmployee);

            return await GetByIdAsync(newEmployee.Id);
        }

        public async Task UpdateAsync(string callerUserName, bool isAdmin, UpdateEmployeeDto request)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == request.Id, x => x.Group!);
            employee.OrThrowNotFound("Nhân viên", request.Id);

            // Phạm vi HIỆN TẠI của nhân viên đang sửa (2026-09-28) — Coordinator chỉ sửa được người
            // đang thuộc đúng Bộ phận/Nhóm mình phụ trách.
            await EnsureCanManageDeptOrGroupScopeAsync(callerUserName, isAdmin, employee!,
                "Bạn chỉ được sửa nhân viên thuộc Bộ phận/Nhóm mình phụ trách.");

            if (employee!.Code != request.Code)
            {
                var exists = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Code == request.Code && !x.IsDeleted);
                if (exists != null) throw new DomainException($"Mã nhân viên '{request.Code}' đã tồn tại.");
            }

            if (!string.IsNullOrWhiteSpace(request.UserName) && employee.UserName != request.UserName)
            {
                var existsUserName = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == request.UserName && !x.IsDeleted);
                if (existsUserName != null) throw new DomainException($"Tài khoản '{request.UserName}' đã được gán cho nhân viên khác.");
            }

            var (groupId, departmentId, scopes) = await ValidateOrganizationAssignmentAsync(request.JobTitleId, request.GroupId, request.DepartmentId, request.ApprovalScopes);
            // Phạm vi MỚI (nếu đổi Nhóm/Chức vụ) cũng phải hợp lệ — không cho "chuyển" nhân viên ra
            // ngoài phạm vi Coordinator đang quản (2026-09-28).
            await EnsureAssignmentInCallerScopeAsync(callerUserName, isAdmin, groupId, departmentId, scopes,
                "Bạn chỉ được chuyển nhân viên vào đúng Bộ phận/Nhóm mình phụ trách.");

            // Chụp lại UserName CŨ trước khi ghi đè — cần để thu hồi quyền tự động cấp khỏi tài khoản
            // cũ nếu Employee này vừa được link sang 1 UserName khác (xem SyncJobTitlePermissionsAsync).
            var oldUserName = employee.UserName;

            employee.Code = request.Code;
            employee.FirstName = request.FirstName;
            employee.LastName = request.LastName;
            employee.UserName = request.UserName;
            employee.GroupId = groupId;
            employee.DepartmentId = departmentId;
            employee.JobTitleId = request.JobTitleId;

            _unitOfWork.Employees.Update(employee);
            await _unitOfWork.SaveChangesAsync();
            await ReplaceApprovalScopesAsync(employee.Id, scopes);

            // Đổi sang UserName khác (không phải chỉ gỡ) — thu hồi quyền tự động đã cấp khỏi tài khoản
            // cũ trước, tránh 1 tài khoản Identity giữ mãi quyền của 1 Employee không còn link tới nó.
            if (!string.IsNullOrWhiteSpace(oldUserName) && oldUserName != employee.UserName)
            {
                await _userDirectoryService.SyncAutoGrantedPermissionsAsync(oldUserName, Array.Empty<string>());
            }
            await SyncAutoGrantedPermissionsCoreAsync(employee);
        }

        // Sửa RIÊNG giới hạn OT/tháng/năm (2026-08-29) — permission hẹp
        // Attendance.Employee.UpdateOtLimit, scope theo Người phụ trách Phòng ban/Nhóm (2026-09-28: đổi
        // từ chỉ-Phòng-ban sang dùng chung EnsureCanManageDeptOrGroupScopeAsync — phụ trách Phòng ban
        // sửa được cả phòng, chỉ phụ trách Nhóm thì chỉ sửa được đúng Nhóm đó). Chỉ set đúng 2 field
        // này, không đụng field nào khác của Employee — xem docs/docs-be/attendance-module.md §Phân
        // quyền theo Phòng ban.
        public async Task<EmployeeDto> UpdateOtLimitAsync(string userName, bool isAdmin, int employeeId, UpdateEmployeeOtLimitDto request)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == employeeId && !x.IsDeleted, x => x.Group!);
            employee.OrThrowNotFound("Nhân viên", employeeId);

            await EnsureCanManageDeptOrGroupScopeAsync(userName, isAdmin, employee!,
                "Bạn chỉ được sửa giới hạn OT của nhân viên thuộc Bộ phận/Nhóm mình phụ trách.");

            employee!.CustomMonthlyOtHourLimit = request.CustomMonthlyOtHourLimit;
            employee.CustomYearlyOtHourLimit = request.CustomYearlyOtHourLimit;

            _unitOfWork.Employees.Update(employee);
            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(employeeId);
        }

        public async Task DeleteAsync(string callerUserName, bool isAdmin, int id)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == id, x => x.Group!);
            employee.OrThrowNotFound("Nhân viên", id);

            await EnsureCanManageDeptOrGroupScopeAsync(callerUserName, isAdmin, employee!,
                "Bạn chỉ được xoá nhân viên thuộc Bộ phận/Nhóm mình phụ trách.");

            employee!.IsDeleted = true;

            _unitOfWork.Employees.Update(employee);
            await _unitOfWork.SaveChangesAsync();

            // Nhân viên bị xoá (mềm) không còn giữ Chức vụ nào theo nghĩa thực tế — thu hồi hết quyền
            // tự động đã cấp cho tài khoản Identity link với họ (nếu có).
            await _userDirectoryService.SyncAutoGrantedPermissionsAsync(employee.UserName, Array.Empty<string>());
        }

        // Tính lại TOÀN BỘ permission "tự động cấp" hiện hành cho 1 Employee — gộp CHUNG 2 nguồn
        // (theo Chức vụ + theo vai trò "Người phụ trách Cây duyệt") trong CÙNG 1 lần gọi
        // IUserDirectoryService.SyncAutoGrantedPermissionsAsync, vì hàm đó THAY NGUYÊN danh sách
        // permission IsAutoGranted=true của user — gọi tách rời theo từng nguồn sẽ khiến nguồn gọi
        // sau xoá mất permission do nguồn kia vừa cấp. No-op nếu chưa có UserName (chưa liên kết tài
        // khoản đăng nhập); khi UserName được gán sau này, lần UpdateAsync đó sẽ tự cấp đúng bộ quyền
        // hiện hành, không cần thao tác gì thêm (xem docs/docs-be/attendance-module.md §Cây chức vụ,
        // mục "Quyền theo Chức vụ" và "Người phụ trách Cây duyệt").
        private async Task SyncAutoGrantedPermissionsCoreAsync(Employee employee)
        {
            if (string.IsNullOrWhiteSpace(employee.UserName)) return;

            var jobTitleCodes = employee.JobTitleId.HasValue
                ? (await _unitOfWork.JobTitlePermissions.FindAsync(x => x.JobTitleId == employee.JobTitleId.Value && !x.IsDeleted))
                    .Select(x => x.PermissionCode)
                : Enumerable.Empty<string>();

            var isDeptCoordinator = (await _unitOfWork.DepartmentApprovalStepCoordinators.FindAsync(
                x => x.EmployeeId == employee.Id && !x.IsDeleted)).Count > 0;
            var isGroupCoordinator = (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                x => x.EmployeeId == employee.Id && !x.IsDeleted)).Count > 0;

            var coordinatorCodes = new List<string>();
            if (isDeptCoordinator || isGroupCoordinator)
            {
                coordinatorCodes.AddRange(ApprovalStepCoordinatorPermissions.BaseViewCodes);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.EmployeeAccumulationUpdateCode);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.EmployeeUpdateOtLimitCode);
                // Import Excel hàng loạt (2026-09-28) — cùng scope Bộ phận/Nhóm với 2 quyền sửa-từng-
                // người ở trên, xem ghi chú tại ApprovalStepCoordinatorPermissions.
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.EmployeeAccumulationImportCode);
                // Hồ sơ nhân viên đầy đủ — y hệt Admin nhưng khoá theo scope (2026-09-28).
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.EmployeeCreateCode);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.EmployeeUpdateCode);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.EmployeeDeleteCode);
            }
            if (isDeptCoordinator)
            {
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.DepartmentUpdateCode);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.ProductionUpdateCode);
                // Nhân sự dưới chuyền (2026-09-28, theo yêu cầu người dùng) — CHỈ Người phụ trách Bộ
                // phận, không cấp cho Nhóm (xem ghi chú tại ApprovalStepCoordinatorPermissions).
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.ProductionEmployeeViewCode);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.ProductionEmployeeUpdateCode);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.ProductionEmployeeImportCode);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.ProductionEmployeeExportCode);
            }
            if (isGroupCoordinator)
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.GroupUpdateCode);

            var desiredCodes = jobTitleCodes.Union(coordinatorCodes).Distinct().ToList();
            await _userDirectoryService.SyncAutoGrantedPermissionsAsync(employee.UserName, desiredCodes);
        }

        public async Task SyncAutoGrantedPermissionsForEmployeeAsync(int employeeId)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(employeeId);
            if (employee == null) return;
            await SyncAutoGrantedPermissionsCoreAsync(employee);
        }

        public async Task<int> ResyncAllCoordinatorPermissionsAsync()
        {
            var deptCoordinatorEmployeeIds = (await _unitOfWork.DepartmentApprovalStepCoordinators.FindAsync(x => !x.IsDeleted))
                .Select(x => x.EmployeeId);
            var groupCoordinatorEmployeeIds = (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(x => !x.IsDeleted))
                .Select(x => x.EmployeeId);
            var employeeIds = deptCoordinatorEmployeeIds.Union(groupCoordinatorEmployeeIds).ToList();

            foreach (var employeeId in employeeIds)
                await SyncAutoGrantedPermissionsForEmployeeAsync(employeeId);

            return employeeIds.Count;
        }

        public async Task<EmployeeDto> AssignDepartmentJobTitleAsync(string userName, bool isAdmin, int employeeId, int departmentId, int? jobTitleId, int? workshopId = null)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(employeeId);
            employee.OrThrowNotFound("Nhân viên", employeeId);

            // Employee phải đang thuộc ĐÚNG Bộ phận đang thao tác (trực tiếp, hoặc qua Group con) —
            // không "mượn" nhân viên Bộ phận khác qua endpoint này dù có quyền phụ trách Bộ phận A.
            var belongsToDepartment = employee!.DepartmentId == departmentId ||
                (await _unitOfWork.EmployeeApprovalScopes.FindAsync(x => x.EmployeeId == employeeId && x.DepartmentId == departmentId)).Count > 0 ||
                (employee.GroupId.HasValue &&
                    (await _unitOfWork.Groups.GetByIdAsync(employee.GroupId.Value)) is Group g && g.DepartmentId == departmentId);
            if (!belongsToDepartment)
                throw new DomainException("Nhân viên này không thuộc Bộ phận đang thao tác.");

            if (!isAdmin)
            {
                var isCoordinator = (await _unitOfWork.DepartmentApprovalStepCoordinators.FindAsync(
                    x => x.DepartmentId == departmentId && x.Employee.UserName == userName && !x.IsDeleted)).Count > 0;
                if (!isCoordinator)
                    throw new DomainException("Bạn không được phân công phụ trách Bộ phận này.");
            }

            JobTitle? jobTitle = null;
            if (jobTitleId.HasValue)
            {
                jobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.Id == jobTitleId.Value && !x.IsDeleted);
                jobTitle.OrThrowNotFound("Chức vụ", jobTitleId.Value);
            }
            var terminalLevel = (JobTitleTerminalLevel)(jobTitle?.TerminalLevel ?? (int)JobTitleTerminalLevel.None);

            // Trưởng Xưởng/Giám đốc dùng chung toàn công ty — vượt phạm vi 1 Bộ phận, chỉ Admin mới
            // được thăng lên 2 cấp này qua đây (Người phụ trách chỉ quản lý ĐÚNG Bộ phận mình phụ trách).
            if (!isAdmin && (terminalLevel == JobTitleTerminalLevel.WorkshopManager || terminalLevel == JobTitleTerminalLevel.GeneralDirector))
                throw new DomainException("Chỉ Admin mới được gán Chức vụ Trưởng Xưởng/Giám đốc.");

            int? nextGroupId = employee.GroupId;
            int? nextDepartmentId = employee.DepartmentId;
            var managerScopes = new List<(int WorkshopId, int DepartmentId)>();

            switch (terminalLevel)
            {
                case JobTitleTerminalLevel.DepartmentManager:
                    nextGroupId = null;
                    nextDepartmentId = employee.DepartmentId ?? departmentId;
                    var scopeWorkshopId = workshopId
                        ?? (await _unitOfWork.Workshops.FirstOrDefaultAsync(x => !x.IsDeleted)).OrThrowNotFound("Xưởng", "mặc định")!.Id;
                    (await _unitOfWork.Workshops.FirstOrDefaultAsync(x => x.Id == scopeWorkshopId && !x.IsDeleted)).OrThrowNotFound("Xưởng", scopeWorkshopId);
                    var pairs = (await _unitOfWork.EmployeeApprovalScopes.FindAsync(x => x.EmployeeId == employeeId))
                        .Select(x => (x.WorkshopId, x.DepartmentId)).ToList();
                    if (!pairs.Contains((scopeWorkshopId, departmentId))) pairs.Add((scopeWorkshopId, departmentId));
                    managerScopes = pairs;
                    break;
                case JobTitleTerminalLevel.WorkshopManager:
                case JobTitleTerminalLevel.GeneralDirector:
                    nextGroupId = null;
                    nextDepartmentId = null;
                    break;
                default:
                    if (employee.GroupId == null)
                        throw new DomainException("Người này hiện không thuộc Nhóm nào — hãy nhờ Admin sửa qua màn Nhân viên.");
                    break; // Chức vụ trung gian/gỡ chức vụ — giữ nguyên Group/Department hiện tại.
            }

            employee.JobTitleId = jobTitleId;
            employee.GroupId = nextGroupId;
            employee.DepartmentId = nextDepartmentId;

            _unitOfWork.Employees.Update(employee);
            await _unitOfWork.SaveChangesAsync();
            await ReplaceApprovalScopesAsync(employee.Id, managerScopes);

            await SyncAutoGrantedPermissionsCoreAsync(employee);

            return await GetByIdAsync(employee.Id);
        }

        public async Task<EmployeeDto> AssignGroupJobTitleAsync(string userName, bool isAdmin, int employeeId, int groupId, int? jobTitleId)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(employeeId);
            employee.OrThrowNotFound("Nhân viên", employeeId);

            if (employee!.GroupId != groupId)
                throw new DomainException("Nhân viên này không thuộc Nhóm đang thao tác.");

            if (!isAdmin)
            {
                var isCoordinator = (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                    x => x.GroupId == groupId && x.Employee.UserName == userName && !x.IsDeleted)).Count > 0;
                if (!isCoordinator)
                    throw new DomainException("Bạn không được phân công phụ trách Nhóm này.");
            }

            if (jobTitleId.HasValue)
            {
                var jobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.Id == jobTitleId.Value && !x.IsDeleted);
                jobTitle.OrThrowNotFound("Chức vụ", jobTitleId.Value);
                if (jobTitle!.TerminalLevel != (int)JobTitleTerminalLevel.None)
                    throw new DomainException("Chỉ được gán Chức vụ cấp trung gian (Staff/Group Leader/Team Leader) ở khối Nhóm.");
            }

            // GroupId/DepartmentId giữ nguyên — Chức vụ cấp trung gian không đổi tổ chức của Employee.
            employee.JobTitleId = jobTitleId;

            _unitOfWork.Employees.Update(employee);
            await _unitOfWork.SaveChangesAsync();

            await SyncAutoGrantedPermissionsCoreAsync(employee);

            return await GetByIdAsync(employee.Id);
        }

        // Nhân viên tự chỉnh lũy kế của chính mình (canAdjustAny=false, so khớp UserName), hoặc
        // người có quyền Attendance.Employee.Update chỉnh cho bất kỳ ai (canAdjustAny=true).
        // Chốt GroupId/DepartmentId thật sự sẽ lưu, dựa theo TerminalLevel của Chức vụ được chọn
        // (2026-08-08 — xem docs/docs-be/attendance-module.md §Cây chức vụ):
        //   - Chưa gán Chức vụ / TerminalLevel=None (nhân viên thường): BẮT BUỘC GroupId, KHÔNG được gửi DepartmentId.
        //   - TerminalLevel=DepartmentManager (Trưởng phòng): BẮT BUỘC DepartmentId, KHÔNG được gửi GroupId
        //     (không thuộc Bộ phận cụ thể nào — chỉ quản lý Phòng ban).
        //   - TerminalLevel=WorkshopManager/GeneralDirector (Trưởng Xưởng/Giám đốc): dùng chung toàn công ty
        //     — KHÔNG được gửi cả GroupId lẫn DepartmentId.
        private async Task<(int? GroupId, int? DepartmentId, List<(int WorkshopId, int DepartmentId)> Scopes)> ValidateOrganizationAssignmentAsync(
            int? jobTitleId, int? groupId, int? departmentId, List<EmployeeApprovalScopeInputDto>? approvalScopes)
        {
            JobTitle? jobTitle = null;
            if (jobTitleId.HasValue)
            {
                jobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.Id == jobTitleId.Value && !x.IsDeleted);
                jobTitle.OrThrowNotFound("Chức vụ", jobTitleId.Value);
            }

            var terminalLevel = (JobTitleTerminalLevel)(jobTitle?.TerminalLevel ?? (int)JobTitleTerminalLevel.None);
            var noScopes = new List<(int WorkshopId, int DepartmentId)>();

            switch (terminalLevel)
            {
                case JobTitleTerminalLevel.WorkshopManager:
                case JobTitleTerminalLevel.GeneralDirector:
                    if (groupId.HasValue || departmentId.HasValue)
                        throw new DomainException("Trưởng Xưởng/Giám đốc dùng chung toàn công ty — không chọn Bộ phận/Phòng ban.");
                    return (null, null, noScopes);

                case JobTitleTerminalLevel.DepartmentManager:
                    if (groupId.HasValue)
                        throw new DomainException("Trưởng phòng không thuộc Bộ phận cụ thể nào — chỉ chọn Phòng ban.");

                    var pairs = (approvalScopes ?? new List<EmployeeApprovalScopeInputDto>())
                        .Select(x => (x.WorkshopId, x.DepartmentId)).Distinct().ToList();
                    // Payload without pairs (single DepartmentId): the default (first) workshop.
                    if (pairs.Count == 0 && departmentId.HasValue)
                    {
                        var defaultWorkshop = (await _unitOfWork.Workshops.FirstOrDefaultAsync(x => !x.IsDeleted)).OrThrowNotFound("Xưởng", "mặc định");
                        pairs.Add((defaultWorkshop!.Id, departmentId.Value));
                    }
                    if (pairs.Count == 0)
                        throw new DomainException("Trưởng phòng phải chọn ít nhất một cặp Xưởng - Phòng ban quản lý.");

                    foreach (var (workshopId, pairDepartmentId) in pairs)
                    {
                        (await _unitOfWork.Workshops.FirstOrDefaultAsync(x => x.Id == workshopId && !x.IsDeleted)).OrThrowNotFound("Xưởng", workshopId);
                        (await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == pairDepartmentId && !x.IsDeleted)).OrThrowNotFound("Phòng ban", pairDepartmentId);
                    }
                    return (null, pairs[0].DepartmentId, pairs);

                default:
                    if (departmentId.HasValue)
                        throw new DomainException("Chỉ Trưởng phòng mới chọn Phòng ban trực tiếp — nhân viên thường chọn Bộ phận.");
                    if (!groupId.HasValue)
                        throw new DomainException("Bộ phận không được để trống.");

                    var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == groupId.Value && !x.IsDeleted);
                    group.OrThrowNotFound("Nhóm", groupId.Value);
                    return (groupId, null, noScopes);
            }
        }

        // Replaces the whole pair set; non-managers pass an empty list, which clears stale pairs.
        private async Task ReplaceApprovalScopesAsync(int employeeId, List<(int WorkshopId, int DepartmentId)> scopes)
        {
            var existing = await _unitOfWork.EmployeeApprovalScopes.FindAsync(x => x.EmployeeId == employeeId);
            if (existing.Count > 0) _unitOfWork.EmployeeApprovalScopes.RemoveRange(existing);
            foreach (var (workshopId, departmentId) in scopes)
                await _unitOfWork.EmployeeApprovalScopes.AddAsync(new EmployeeApprovalScope { EmployeeId = employeeId, WorkshopId = workshopId, DepartmentId = departmentId });
            await _unitOfWork.SaveChangesAsync();
        }
    }
}

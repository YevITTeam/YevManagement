using Attendance.Application.Dtos.EmployeeAccumulationHistories;
using Attendance.Application.Dtos.Employees;
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

        public EmployeeService(
            IAttendanceUnitOfWork unitOfWork, IUserDirectoryService userDirectoryService, IAttendanceSettingService attendanceSettingService)
            : base(unitOfWork)
        {
            _userDirectoryService = userDirectoryService;
            _attendanceSettingService = attendanceSettingService;
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

        public async Task<PagedResponse<EmployeeDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword, int? departmentId, int? groupId)
        {
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var query = _unitOfWork.Employees.GetQueryable(false, x => x.Group!, x => x.Department!, x => x.JobTitle!).Where(x => !x.IsDeleted);

            // Khớp cả 2 đường tới Department: trực tiếp (Trưởng phòng, xem Employee.DepartmentId) hoặc
            // qua Group (nhân viên thường) — Trưởng Xưởng/Giám đốc (cả GroupId lẫn DepartmentId đều
            // null, dùng chung toàn công ty) sẽ không khớp bộ lọc theo Phòng ban nào cả, đúng ý nghĩa.
            if (departmentId.HasValue)
                query = query.Where(x => x.DepartmentId == departmentId.Value || (x.Group != null && x.Group.DepartmentId == departmentId.Value));
            if (groupId.HasValue)
                query = query.Where(x => x.GroupId == groupId.Value);

            var orderedQuery = query.OrderBy(x => x.Code);

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
                orderedQuery = query.OrderBy(x => x.Code == keyword ? 0 : 1).ThenBy(x => x.Code);
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
                    JobTitleName = x.JobTitle != null ? x.JobTitle.Name : null
                }
            );
        }

        // Toàn bộ nhân viên active (mọi Group) — dùng cho các dropdown/công cụ cần chọn 1 nhân viên bất
        // kỳ, vd JobTitle "Thử chuỗi duyệt" (docs/docs-be/attendance-module.md §Cây chức vụ).
        public async Task<List<EmployeeDto>> GetAllActiveAsync()
        {
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var items = await _unitOfWork.Employees.SelectAsync(
                predicate: x => !x.IsDeleted,
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
                    JobTitleName = x.JobTitle != null ? x.JobTitle.Name : null
                }
            );
            return items.OrderBy(x => x.Code).ToList();
        }

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
                    JobTitleName = x.JobTitle != null ? x.JobTitle.Name : null
                }
            );

            var target = targetDate ?? DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());
            var employeeIds = items.Select(x => x.Id).ToList();
            if (employeeIds.Count > 0)
            {
                var mainMealTicketMinHours = await _attendanceSettingService.GetMainMealTicketMinHoursAsync();

                // !IsRemoved + Status != Rejected + !IsDeleted = đơn còn "đang treo" (kể cả Completed —
                // vẫn tính vào Dự kiến, xem Employee.cs cũ/docs §Lũy kế Dự kiến). Chỉ lấy đúng năm của
                // targetDate rồi lọc tháng ở C# để 1 lượt query dùng được cho cả MonthToDate lẫn YearToDate.
                var pendingRows = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                    x => employeeIds.Contains(x.EmployeeId) && !x.IsRemoved && x.OtForm.Status != (int)OtFormStatus.Rejected
                         && !x.OtForm.IsDeleted && x.OtForm.Date.Year == target.Year,
                    x => x.OtForm);

                var rowsByEmployee = pendingRows.GroupBy(x => x.EmployeeId).ToDictionary(g => g.Key, g => g.ToList());
                foreach (var item in items)
                {
                    if (!rowsByEmployee.TryGetValue(item.Id, out var rows)) continue;
                    item.ProjectedMonthToDate = rows.Where(x => x.OtForm.Date.Month == target.Month)
                        .Sum(x => CalculateProjectedHours(x, mainMealTicketMinHours));
                    item.ProjectedYearToDate = rows.Sum(x => CalculateProjectedHours(x, mainMealTicketMinHours));
                }
            }

            return items.OrderBy(x => x.Code).ToList();
        }

        // Mirror OtFormService.CalculateOtHours (+30 phút nếu đủ ngưỡng phiếu ăn mà không ăn) — không
        // gọi chéo sang OtFormService, mỗi service tự chứa logic tính giờ của mình.
        private static decimal CalculateProjectedHours(OtFormEmployee row, decimal mainMealTicketMinHours)
        {
            var hours = (decimal)(row.EndTime - row.StartTime).TotalHours;
            if (hours >= mainMealTicketMinHours && !row.DidEat) hours += 0.5m;
            return hours;
        }

        // Toàn bộ nhân viên active thuộc Phòng ban (mọi Group con, CỘNG Trưởng phòng gán trực tiếp
        // DepartmentId) — dùng cho màn "Cây duyệt Phòng ban" (xem ai đang giữ Chức vụ nào trong Phòng
        // ban để cấu hình/gán nhanh — docs/attendance-module.md §Cây chức vụ).
        public async Task<List<EmployeeDto>> GetByDepartmentIdAsync(int departmentId)
        {
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var items = await _unitOfWork.Employees.SelectAsync(
                predicate: x => !x.IsDeleted && (x.DepartmentId == departmentId || (x.Group != null && x.Group.DepartmentId == departmentId)),
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
                    JobTitleName = x.JobTitle != null ? x.JobTitle.Name : null
                }
            );
            return items.OrderBy(x => x.Code).ToList();
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
            {
                var caller = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == callerUserName && !x.IsDeleted, x => x.JobTitle!);
                if (caller == null)
                    throw new DomainException("Tài khoản của bạn chưa liên kết với hồ sơ Nhân viên nào.");

                var callerTerminalLevel = (JobTitleTerminalLevel)(caller.JobTitle?.TerminalLevel ?? (int)JobTitleTerminalLevel.None);

                if (callerTerminalLevel == JobTitleTerminalLevel.WorkshopManager || callerTerminalLevel == JobTitleTerminalLevel.GeneralDirector)
                {
                    // Toàn công ty — không lọc thêm.
                }
                else if (caller.DepartmentId.HasValue)
                {
                    var departmentId = caller.DepartmentId.Value;
                    query = query.Where(x => x.DepartmentId == departmentId || (x.Group != null && x.Group.DepartmentId == departmentId));
                }
                else if (caller.GroupId.HasValue)
                {
                    var groupId = caller.GroupId.Value;
                    query = query.Where(x => x.GroupId == groupId);
                }
                else
                {
                    throw new DomainException("Tài khoản của bạn chưa được gán Nhóm/Bộ phận nào.");
                }
            }

            var orderedQuery = query.OrderBy(x => x.Code);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x =>
                    x.Code.Contains(keyword) ||
                    x.FirstName.Contains(keyword) ||
                    x.LastName.Contains(keyword) ||
                    (x.LastName + " " + x.FirstName).Contains(keyword));
                orderedQuery = query.OrderBy(x => x.Code == keyword ? 0 : 1).ThenBy(x => x.Code);
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
                    JobTitleName = x.JobTitle != null ? x.JobTitle.Name : null
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

            var rows = await _unitOfWork.EmployeeAccumulationHistories.FindAsync(x => x.EmployeeId == employeeId && x.Year == year);
            var hoursByMonth = rows.ToDictionary(x => x.Month, x => x.TotalHours);

            var months = new List<EmployeeAccumulationHistoryDto>();
            decimal yearTotal = 0;
            for (var month = 1; month <= 12; month++)
            {
                var hours = hoursByMonth.GetValueOrDefault(month, 0m);
                months.Add(new EmployeeAccumulationHistoryDto { Month = month, TotalHours = hours });
                yearTotal += hours;
            }

            return new EmployeeAccumulationHistoryYearDto
            {
                EmployeeId = employee!.Id,
                EmployeeCode = employee.Code,
                EmployeeFullName = $"{employee.LastName} {employee.FirstName}",
                Year = year,
                Months = months,
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

            if (caller.DepartmentId.HasValue)
            {
                var targetDepartmentId = targetEmployee.DepartmentId;
                if (targetDepartmentId == null && targetEmployee.GroupId.HasValue)
                {
                    var targetGroup = await _unitOfWork.Groups.GetByIdAsync(targetEmployee.GroupId.Value);
                    targetDepartmentId = targetGroup?.DepartmentId;
                }
                if (targetDepartmentId == caller.DepartmentId) return;
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

        public async Task<EmployeeDto> GetByIdAsync(int id)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, x => x.Group!, x => x.Department!, x => x.JobTitle!);
            employee.OrThrowNotFound("Nhân viên", id);

            var (monthToDate, yearToDate) = await GetRealAccumulationAsync(id);

            return new EmployeeDto
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
                JobTitleName = employee.JobTitle?.Name
            };
        }

        // Nhân viên tự tra employeeId của chính mình (màn "Lũy kế của tôi") — so khớp Employee.UserName.
        public async Task<EmployeeDto> GetByUserNameAsync(string userName)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == userName && !x.IsDeleted, x => x.Group!, x => x.Department!, x => x.JobTitle!);
            employee.OrThrowNotFound("Nhân viên (tài khoản chưa được gán cho nhân viên nào)", userName);

            var (monthToDate, yearToDate) = await GetRealAccumulationAsync(employee!.Id);

            return new EmployeeDto
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
                JobTitleName = employee.JobTitle?.Name
            };
        }

        public async Task<EmployeeDto> CreateAsync(CreateEmployeeDto request)
        {
            var exists = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Code == request.Code && !x.IsDeleted);
            if (exists != null) throw new DomainException($"Mã nhân viên '{request.Code}' đã tồn tại.");

            if (!string.IsNullOrWhiteSpace(request.UserName))
            {
                var existsUserName = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == request.UserName && !x.IsDeleted);
                if (existsUserName != null) throw new DomainException($"Tài khoản '{request.UserName}' đã được gán cho nhân viên khác.");
            }

            var (groupId, departmentId) = await ValidateOrganizationAssignmentAsync(request.JobTitleId, request.GroupId, request.DepartmentId);

            var newEmployee = new Employee
            {
                Code = request.Code,
                FirstName = request.FirstName,
                LastName = request.LastName,
                UserName = request.UserName,
                GroupId = groupId,
                DepartmentId = departmentId,
                JobTitleId = request.JobTitleId,
                IsDeleted = false
            };

            await _unitOfWork.Employees.AddAsync(newEmployee);
            await _unitOfWork.SaveChangesAsync();

            await SyncAutoGrantedPermissionsCoreAsync(newEmployee);

            return await GetByIdAsync(newEmployee.Id);
        }

        public async Task UpdateAsync(UpdateEmployeeDto request)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(request.Id);
            employee.OrThrowNotFound("Nhân viên", request.Id);

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

            var (groupId, departmentId) = await ValidateOrganizationAssignmentAsync(request.JobTitleId, request.GroupId, request.DepartmentId);

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

            // Đổi sang UserName khác (không phải chỉ gỡ) — thu hồi quyền tự động đã cấp khỏi tài khoản
            // cũ trước, tránh 1 tài khoản Identity giữ mãi quyền của 1 Employee không còn link tới nó.
            if (!string.IsNullOrWhiteSpace(oldUserName) && oldUserName != employee.UserName)
            {
                await _userDirectoryService.SyncAutoGrantedPermissionsAsync(oldUserName, Array.Empty<string>());
            }
            await SyncAutoGrantedPermissionsCoreAsync(employee);
        }

        public async Task DeleteAsync(int id)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(id);
            employee.OrThrowNotFound("Nhân viên", id);

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
                coordinatorCodes.AddRange(ApprovalStepCoordinatorPermissions.BaseViewCodes);
            if (isDeptCoordinator)
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.DepartmentUpdateCode);
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

        public async Task<EmployeeDto> AssignDepartmentJobTitleAsync(string userName, bool isAdmin, int employeeId, int departmentId, int? jobTitleId)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(employeeId);
            employee.OrThrowNotFound("Nhân viên", employeeId);

            // Employee phải đang thuộc ĐÚNG Bộ phận đang thao tác (trực tiếp, hoặc qua Group con) —
            // không "mượn" nhân viên Bộ phận khác qua endpoint này dù có quyền phụ trách Bộ phận A.
            var belongsToDepartment = employee!.DepartmentId == departmentId ||
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

            switch (terminalLevel)
            {
                case JobTitleTerminalLevel.DepartmentManager:
                    nextGroupId = null;
                    nextDepartmentId = departmentId;
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
        private async Task<(int? GroupId, int? DepartmentId)> ValidateOrganizationAssignmentAsync(int? jobTitleId, int? groupId, int? departmentId)
        {
            JobTitle? jobTitle = null;
            if (jobTitleId.HasValue)
            {
                jobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.Id == jobTitleId.Value && !x.IsDeleted);
                jobTitle.OrThrowNotFound("Chức vụ", jobTitleId.Value);
            }

            var terminalLevel = (JobTitleTerminalLevel)(jobTitle?.TerminalLevel ?? (int)JobTitleTerminalLevel.None);

            switch (terminalLevel)
            {
                case JobTitleTerminalLevel.WorkshopManager:
                case JobTitleTerminalLevel.GeneralDirector:
                    if (groupId.HasValue || departmentId.HasValue)
                        throw new DomainException("Trưởng Xưởng/Giám đốc dùng chung toàn công ty — không chọn Bộ phận/Phòng ban.");
                    return (null, null);

                case JobTitleTerminalLevel.DepartmentManager:
                    if (groupId.HasValue)
                        throw new DomainException("Trưởng phòng không thuộc Bộ phận cụ thể nào — chỉ chọn Phòng ban.");
                    if (!departmentId.HasValue)
                        throw new DomainException("Trưởng phòng phải chọn Phòng ban quản lý.");

                    var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == departmentId.Value && !x.IsDeleted);
                    department.OrThrowNotFound("Phòng ban", departmentId.Value);
                    return (null, departmentId);

                default:
                    if (departmentId.HasValue)
                        throw new DomainException("Chỉ Trưởng phòng mới chọn Phòng ban trực tiếp — nhân viên thường chọn Bộ phận.");
                    if (!groupId.HasValue)
                        throw new DomainException("Bộ phận không được để trống.");

                    var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == groupId.Value && !x.IsDeleted);
                    group.OrThrowNotFound("Nhóm", groupId.Value);
                    return (groupId, null);
            }
        }
    }
}

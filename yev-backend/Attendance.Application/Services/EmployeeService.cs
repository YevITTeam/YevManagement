using Attendance.Application.Dtos.Employees;
using Attendance.Application.Interfaces.Service;
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

        public EmployeeService(IAttendanceUnitOfWork unitOfWork, IUserDirectoryService userDirectoryService) : base(unitOfWork)
        {
            _userDirectoryService = userDirectoryService;
        }

        public async Task<PagedResponse<EmployeeDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword, int? departmentId, int? groupId)
        {
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
                    MonthToDate = x.MonthToDate,
                    YearToDate = x.YearToDate,
                    AccumulationYear = x.AccumulationYear,
                    AccumulationMonth = x.AccumulationMonth,
                    ProjectedMonthToDate = x.ProjectedMonthToDate,
                    ProjectedYearToDate = x.ProjectedYearToDate,
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
            var items = await _unitOfWork.Employees.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new EmployeeDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    FirstName = x.FirstName,
                    LastName = x.LastName,
                    UserName = x.UserName,
                    MonthToDate = x.MonthToDate,
                    YearToDate = x.YearToDate,
                    AccumulationYear = x.AccumulationYear,
                    AccumulationMonth = x.AccumulationMonth,
                    ProjectedMonthToDate = x.ProjectedMonthToDate,
                    ProjectedYearToDate = x.ProjectedYearToDate,
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
        public async Task<List<EmployeeDto>> GetByGroupIdAsync(int groupId)
        {
            var items = await _unitOfWork.Employees.SelectAsync(
                predicate: x => !x.IsDeleted && x.GroupId == groupId,
                selector: x => new EmployeeDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    FirstName = x.FirstName,
                    LastName = x.LastName,
                    UserName = x.UserName,
                    MonthToDate = x.MonthToDate,
                    YearToDate = x.YearToDate,
                    AccumulationYear = x.AccumulationYear,
                    AccumulationMonth = x.AccumulationMonth,
                    ProjectedMonthToDate = x.ProjectedMonthToDate,
                    ProjectedYearToDate = x.ProjectedYearToDate,
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

        // Toàn bộ nhân viên active thuộc Phòng ban (mọi Group con, CỘNG Trưởng phòng gán trực tiếp
        // DepartmentId) — dùng cho màn "Cây duyệt Phòng ban" (xem ai đang giữ Chức vụ nào trong Phòng
        // ban để cấu hình/gán nhanh — docs/attendance-module.md §Cây chức vụ).
        public async Task<List<EmployeeDto>> GetByDepartmentIdAsync(int departmentId)
        {
            var items = await _unitOfWork.Employees.SelectAsync(
                predicate: x => !x.IsDeleted && (x.DepartmentId == departmentId || (x.Group != null && x.Group.DepartmentId == departmentId)),
                selector: x => new EmployeeDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    FirstName = x.FirstName,
                    LastName = x.LastName,
                    UserName = x.UserName,
                    MonthToDate = x.MonthToDate,
                    YearToDate = x.YearToDate,
                    AccumulationYear = x.AccumulationYear,
                    AccumulationMonth = x.AccumulationMonth,
                    ProjectedMonthToDate = x.ProjectedMonthToDate,
                    ProjectedYearToDate = x.ProjectedYearToDate,
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

        public async Task<EmployeeDto> GetByIdAsync(int id)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, x => x.Group!, x => x.Department!, x => x.JobTitle!);
            employee.OrThrowNotFound("Nhân viên", id);

            return new EmployeeDto
            {
                Id = employee!.Id,
                Code = employee.Code,
                FirstName = employee.FirstName,
                LastName = employee.LastName,
                UserName = employee.UserName,
                MonthToDate = employee.MonthToDate,
                YearToDate = employee.YearToDate,
                AccumulationYear = employee.AccumulationYear,
                AccumulationMonth = employee.AccumulationMonth,
                ProjectedMonthToDate = employee.ProjectedMonthToDate,
                ProjectedYearToDate = employee.ProjectedYearToDate,
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

            return new EmployeeDto
            {
                Id = employee!.Id,
                Code = employee.Code,
                FirstName = employee.FirstName,
                LastName = employee.LastName,
                UserName = employee.UserName,
                MonthToDate = employee.MonthToDate,
                YearToDate = employee.YearToDate,
                AccumulationYear = employee.AccumulationYear,
                AccumulationMonth = employee.AccumulationMonth,
                ProjectedMonthToDate = employee.ProjectedMonthToDate,
                ProjectedYearToDate = employee.ProjectedYearToDate,
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

            var now = TimeHelper.GetCurrentUtcTime();
            var newEmployee = new Employee
            {
                Code = request.Code,
                FirstName = request.FirstName,
                LastName = request.LastName,
                UserName = request.UserName,
                MonthToDate = request.MonthToDate,
                YearToDate = request.YearToDate,
                AccumulationYear = now.Year,
                AccumulationMonth = now.Month,
                GroupId = groupId,
                DepartmentId = departmentId,
                JobTitleId = request.JobTitleId,
                IsDeleted = false
            };

            await _unitOfWork.Employees.AddAsync(newEmployee);
            await _unitOfWork.SaveChangesAsync();

            await SyncJobTitlePermissionsAsync(newEmployee.JobTitleId, newEmployee.UserName);

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

            var now = TimeHelper.GetCurrentUtcTime();
            employee.Code = request.Code;
            employee.FirstName = request.FirstName;
            employee.LastName = request.LastName;
            employee.UserName = request.UserName;
            employee.MonthToDate = request.MonthToDate;
            employee.YearToDate = request.YearToDate;
            employee.AccumulationYear = now.Year;
            employee.AccumulationMonth = now.Month;
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
            await SyncJobTitlePermissionsAsync(employee.JobTitleId, employee.UserName);
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

        // Tính lại danh sách permission "tự động cấp theo Chức vụ" cho đúng JobTitleId hiện tại rồi
        // đồng bộ vào Identity qua IUserDirectoryService — no-op nếu chưa có UserName (chưa link tài
        // khoản đăng nhập); khi UserName được gán sau này, lần gọi UpdateAsync đó sẽ tự cấp đúng bộ
        // quyền hiện hành, không cần thao tác gì thêm (xem docs/docs-be/attendance-module.md §Cây
        // chức vụ, mục "Quyền theo Chức vụ").
        private async Task SyncJobTitlePermissionsAsync(int? jobTitleId, string? userName)
        {
            if (string.IsNullOrWhiteSpace(userName)) return;

            var desiredCodes = jobTitleId.HasValue
                ? (await _unitOfWork.JobTitlePermissions.FindAsync(x => x.JobTitleId == jobTitleId.Value && !x.IsDeleted))
                    .Select(x => x.PermissionCode)
                    .ToList()
                : new List<string>();

            await _userDirectoryService.SyncAutoGrantedPermissionsAsync(userName, desiredCodes);
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

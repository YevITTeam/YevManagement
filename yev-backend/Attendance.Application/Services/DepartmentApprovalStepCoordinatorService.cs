using Attendance.Application.Dtos.DepartmentApprovalStepCoordinators;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Quản lý danh sách Employee được Admin CHỈ ĐỊNH TAY phụ trách cấu hình Cây duyệt của 1 Bộ phận
    // (2026-08-11, sửa 2026-08-11b: khoá theo EmployeeId, chỉ chọn được Employee thuộc đúng Bộ phận)
    // — xem docs/docs-be/attendance-module.md §Cây chức vụ, mục "Người phụ trách Cây duyệt". Quản lý
    // kiểu "thay nguyên danh sách" (mirror JobTitlePermissionService).
    public class DepartmentApprovalStepCoordinatorService : BaseService<IAttendanceUnitOfWork>, IDepartmentApprovalStepCoordinatorService
    {
        private readonly IEmployeeService _employeeService;

        public DepartmentApprovalStepCoordinatorService(IAttendanceUnitOfWork unitOfWork, IEmployeeService employeeService) : base(unitOfWork)
        {
            _employeeService = employeeService;
        }

        public async Task<List<DepartmentApprovalStepCoordinatorDto>> GetByDepartmentAsync(int departmentId)
        {
            var department = await _unitOfWork.Departments.GetByIdAsync(departmentId);
            department.OrThrowNotFound("Phòng ban", departmentId);

            var items = await _unitOfWork.DepartmentApprovalStepCoordinators.FindAsync(x => x.DepartmentId == departmentId && !x.IsDeleted);
            var employeeIds = items.Select(x => x.EmployeeId).Distinct().ToList();
            var employees = employeeIds.Count == 0
                ? new List<Employee>()
                : (await _unitOfWork.Employees.FindAsync(x => employeeIds.Contains(x.Id))).ToList();

            var result = items
                .Select(item =>
                {
                    var employee = employees.FirstOrDefault(e => e.Id == item.EmployeeId);
                    return new DepartmentApprovalStepCoordinatorDto
                    {
                        Id = item.Id,
                        DepartmentId = item.DepartmentId,
                        EmployeeId = item.EmployeeId,
                        EmployeeCode = employee?.Code ?? "",
                        FullName = employee != null ? $"{employee.LastName} {employee.FirstName}" : "",
                        UserName = employee?.UserName
                    };
                })
                .OrderBy(x => x.FullName)
                .ToList();
            return result;
        }

        public async Task<List<DepartmentApprovalStepCoordinatorDto>> ReplaceAsync(int departmentId, ReplaceDepartmentApprovalStepCoordinatorsDto request)
        {
            var department = await _unitOfWork.Departments.GetByIdAsync(departmentId);
            department.OrThrowNotFound("Phòng ban", departmentId);

            var employeeIds = request.EmployeeIds.Distinct().ToList();
            if (employeeIds.Count > 0)
            {
                // Chỉ được chọn Employee đang thuộc ĐÚNG Bộ phận này — trực tiếp (Trưởng phòng) hoặc
                // qua Group con (nhân viên thường), cùng cách khớp Department đã dùng ở
                // EmployeeService.GetPagedAsync.
                var validEmployees = await _unitOfWork.Employees.FindAsync(x =>
                    employeeIds.Contains(x.Id) && !x.IsDeleted &&
                    (x.DepartmentId == departmentId || (x.GroupId != null && x.Group!.DepartmentId == departmentId)));
                if (validEmployees.Count != employeeIds.Count)
                    throw new DomainException("Chỉ được chọn nhân viên đang thuộc Bộ phận này làm người phụ trách.");
            }

            var existing = await _unitOfWork.DepartmentApprovalStepCoordinators.FindAsync(x => x.DepartmentId == departmentId && !x.IsDeleted);
            var oldEmployeeIds = existing.Select(x => x.EmployeeId).ToList();
            foreach (var item in existing)
            {
                _unitOfWork.DepartmentApprovalStepCoordinators.Delete(item);
            }

            var newItems = employeeIds
                .Select(employeeId => new DepartmentApprovalStepCoordinator { DepartmentId = departmentId, EmployeeId = employeeId, IsDeleted = false })
                .ToList();

            await _unitOfWork.DepartmentApprovalStepCoordinators.AddRangeAsync(newItems);
            await _unitOfWork.SaveChangesAsync();

            // Đồng bộ lại quyền tự động cấp cho MỌI Employee bị ảnh hưởng (vừa thêm lẫn vừa bị gỡ) —
            // có hiệu lực NGAY nếu họ đã liên kết UserName; nếu chưa, lần EmployeeService.UpdateAsync
            // liên kết UserName sau này sẽ tự cấp đúng bộ quyền hiện hành, không cần thao tác gì thêm.
            var affectedEmployeeIds = oldEmployeeIds.Union(employeeIds).Distinct();
            foreach (var employeeId in affectedEmployeeIds)
            {
                await _employeeService.SyncAutoGrantedPermissionsForEmployeeAsync(employeeId);
            }

            return await GetByDepartmentAsync(departmentId);
        }

        public async Task EnsureCoordinatorAsync(int departmentId, int employeeId)
        {
            var department = await _unitOfWork.Departments.GetByIdAsync(departmentId);
            department.OrThrowNotFound("Phòng ban", departmentId);

            var alreadyCoordinator = (await _unitOfWork.DepartmentApprovalStepCoordinators.FindAsync(
                x => x.DepartmentId == departmentId && x.EmployeeId == employeeId && !x.IsDeleted)).Count > 0;
            if (alreadyCoordinator) return;

            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x =>
                x.Id == employeeId && !x.IsDeleted &&
                (x.DepartmentId == departmentId || (x.GroupId != null && x.Group!.DepartmentId == departmentId)));
            if (employee == null)
                throw new DomainException("Chỉ được chọn nhân viên đang thuộc Bộ phận này làm người phụ trách.");

            await _unitOfWork.DepartmentApprovalStepCoordinators.AddAsync(
                new DepartmentApprovalStepCoordinator { DepartmentId = departmentId, EmployeeId = employeeId, IsDeleted = false });
            await _unitOfWork.SaveChangesAsync();

            await _employeeService.SyncAutoGrantedPermissionsForEmployeeAsync(employeeId);
        }
    }
}

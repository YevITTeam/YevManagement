using Attendance.Application.Dtos.DepartmentApprovalStepCoordinators;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Coordinators are assigned manually by Admin and keyed by EmployeeId; managed as a whole-list replace.
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
                // Only employees of this department, directly or via a child group, matching EmployeeService.GetPagedAsync.
                var validEmployees = await _unitOfWork.Employees.FindAsync(x =>
                    employeeIds.Contains(x.Id) && !x.IsDeleted &&
                    (x.DepartmentId == departmentId || x.ApprovalScopes.Any(s => s.DepartmentId == departmentId) || (x.GroupId != null && x.Group!.DepartmentId == departmentId)));
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

            // Resync both added and removed employees so permissions apply immediately; unlinked ones get them on UserName link.
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
                (x.DepartmentId == departmentId || x.ApprovalScopes.Any(s => s.DepartmentId == departmentId) || (x.GroupId != null && x.Group!.DepartmentId == departmentId)));
            if (employee == null)
                throw new DomainException("Chỉ được chọn nhân viên đang thuộc Bộ phận này làm người phụ trách.");

            await _unitOfWork.DepartmentApprovalStepCoordinators.AddAsync(
                new DepartmentApprovalStepCoordinator { DepartmentId = departmentId, EmployeeId = employeeId, IsDeleted = false });
            await _unitOfWork.SaveChangesAsync();

            await _employeeService.SyncAutoGrantedPermissionsForEmployeeAsync(employeeId);
        }
    }
}

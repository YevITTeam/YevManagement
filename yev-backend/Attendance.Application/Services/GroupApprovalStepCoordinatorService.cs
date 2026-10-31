using Attendance.Application.Dtos.GroupApprovalStepCoordinators;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Coordinators are assigned manually by Admin and keyed by EmployeeId; mirrors DepartmentApprovalStepCoordinatorService.
    public class GroupApprovalStepCoordinatorService : BaseService<IAttendanceUnitOfWork>, IGroupApprovalStepCoordinatorService
    {
        private readonly IEmployeeService _employeeService;

        public GroupApprovalStepCoordinatorService(IAttendanceUnitOfWork unitOfWork, IEmployeeService employeeService) : base(unitOfWork)
        {
            _employeeService = employeeService;
        }

        public async Task<List<GroupApprovalStepCoordinatorDto>> GetByGroupAsync(int groupId)
        {
            var group = await _unitOfWork.Groups.GetByIdAsync(groupId);
            group.OrThrowNotFound("Nhóm", groupId);

            var items = await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(x => x.GroupId == groupId && !x.IsDeleted);
            var employeeIds = items.Select(x => x.EmployeeId).Distinct().ToList();
            var employees = employeeIds.Count == 0
                ? new List<Employee>()
                : (await _unitOfWork.Employees.FindAsync(x => employeeIds.Contains(x.Id))).ToList();

            var result = items
                .Select(item =>
                {
                    var employee = employees.FirstOrDefault(e => e.Id == item.EmployeeId);
                    return new GroupApprovalStepCoordinatorDto
                    {
                        Id = item.Id,
                        GroupId = item.GroupId,
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

        public async Task<List<GroupApprovalStepCoordinatorDto>> ReplaceAsync(int groupId, ReplaceGroupApprovalStepCoordinatorsDto request)
        {
            var group = await _unitOfWork.Groups.GetByIdAsync(groupId);
            group.OrThrowNotFound("Nhóm", groupId);

            var employeeIds = request.EmployeeIds.Distinct().ToList();
            if (employeeIds.Count > 0)
            {
                var validEmployees = await _unitOfWork.Employees.FindAsync(x =>
                    employeeIds.Contains(x.Id) && !x.IsDeleted && x.GroupId == groupId);
                if (validEmployees.Count != employeeIds.Count)
                    throw new DomainException("Chỉ được chọn nhân viên đang thuộc Nhóm này làm người phụ trách.");
            }

            var existing = await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(x => x.GroupId == groupId && !x.IsDeleted);
            var oldEmployeeIds = existing.Select(x => x.EmployeeId).ToList();
            foreach (var item in existing)
            {
                _unitOfWork.GroupApprovalStepCoordinators.Delete(item);
            }

            var newItems = employeeIds
                .Select(employeeId => new GroupApprovalStepCoordinator { GroupId = groupId, EmployeeId = employeeId, IsDeleted = false })
                .ToList();

            await _unitOfWork.GroupApprovalStepCoordinators.AddRangeAsync(newItems);
            await _unitOfWork.SaveChangesAsync();

            var affectedEmployeeIds = oldEmployeeIds.Union(employeeIds).Distinct();
            foreach (var employeeId in affectedEmployeeIds)
            {
                await _employeeService.SyncAutoGrantedPermissionsForEmployeeAsync(employeeId);
            }

            return await GetByGroupAsync(groupId);
        }

        public async Task EnsureCoordinatorAsync(int groupId, int employeeId)
        {
            var group = await _unitOfWork.Groups.GetByIdAsync(groupId);
            group.OrThrowNotFound("Nhóm", groupId);

            var alreadyCoordinator = (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                x => x.GroupId == groupId && x.EmployeeId == employeeId && !x.IsDeleted)).Count > 0;
            if (alreadyCoordinator) return;

            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == employeeId && !x.IsDeleted && x.GroupId == groupId);
            if (employee == null)
                throw new DomainException("Chỉ được chọn nhân viên đang thuộc Nhóm này làm người phụ trách.");

            await _unitOfWork.GroupApprovalStepCoordinators.AddAsync(
                new GroupApprovalStepCoordinator { GroupId = groupId, EmployeeId = employeeId, IsDeleted = false });
            await _unitOfWork.SaveChangesAsync();

            await _employeeService.SyncAutoGrantedPermissionsForEmployeeAsync(employeeId);
        }
    }
}

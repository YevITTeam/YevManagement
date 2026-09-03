using Attendance.Application.Interfaces.Service;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class DepartmentAccessGuardService : BaseService<IAttendanceUnitOfWork>, IDepartmentAccessGuard
    {
        public DepartmentAccessGuardService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task EnsureCanManageDepartmentAsync(string userName, bool isAdmin, int departmentId)
        {
            if (isAdmin) return;

            var isCoordinator = (await _unitOfWork.DepartmentApprovalStepCoordinators.FindAsync(
                x => x.DepartmentId == departmentId && x.Employee.UserName == userName && !x.IsDeleted)).Count > 0;
            if (!isCoordinator)
                throw new DomainException("Bạn không được phân công phụ trách Phòng ban này.");
        }

        public async Task<HashSet<int>> GetManagedDepartmentIdsAsync(string userName)
        {
            var rows = await _unitOfWork.DepartmentApprovalStepCoordinators.FindAsync(
                x => x.Employee.UserName == userName && !x.IsDeleted);
            return rows.Select(x => x.DepartmentId).ToHashSet();
        }
    }
}

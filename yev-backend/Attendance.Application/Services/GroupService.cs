using Attendance.Application.Dtos.Groups;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class GroupService : BaseService<IAttendanceUnitOfWork>, IGroupService
    {
        public GroupService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<GroupDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.Groups.GetQueryable(false, x => x.Department, x => x.RequesterEmployee!, x => x.ResponsibleEmployee!).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.GroupCode.Contains(keyword) || x.GroupNameVn.Contains(keyword));
            }

            return await _unitOfWork.Groups.ToPagedResponseAsync(
                query.OrderBy(x => x.GroupCode),
                pageIndex,
                pageSize,
                x => new GroupDto
                {
                    Id = x.Id,
                    GroupCode = x.GroupCode,
                    GroupNameVn = x.GroupNameVn,
                    GroupNameJp = x.GroupNameJp,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department.DepartmentNameVn,
                    RequesterEmployeeId = x.RequesterEmployeeId,
                    RequesterFullName = x.RequesterEmployee != null ? $"{x.RequesterEmployee.LastName} {x.RequesterEmployee.FirstName}" : null,
                    ResponsibleEmployeeId = x.ResponsibleEmployeeId,
                    ResponsibleFullName = x.ResponsibleEmployee != null ? $"{x.ResponsibleEmployee.LastName} {x.ResponsibleEmployee.FirstName}" : null
                }
            );
        }

        public async Task<List<GroupDto>> GetAllActiveAsync()
        {
            var groups = await _unitOfWork.Groups.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new GroupDto
                {
                    Id = x.Id,
                    GroupCode = x.GroupCode,
                    GroupNameVn = x.GroupNameVn,
                    GroupNameJp = x.GroupNameJp,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department.DepartmentNameVn,
                    RequesterEmployeeId = x.RequesterEmployeeId,
                    RequesterFullName = x.RequesterEmployee != null ? $"{x.RequesterEmployee.LastName} {x.RequesterEmployee.FirstName}" : null,
                    ResponsibleEmployeeId = x.ResponsibleEmployeeId,
                    ResponsibleFullName = x.ResponsibleEmployee != null ? $"{x.ResponsibleEmployee.LastName} {x.ResponsibleEmployee.FirstName}" : null
                }
            );
            return groups.OrderBy(x => x.GroupNameVn).ToList();
        }

        public async Task<List<GroupDto>> GetByDepartmentIdAsync(int departmentId)
        {
            var groups = await _unitOfWork.Groups.SelectAsync(
                predicate: x => !x.IsDeleted && x.DepartmentId == departmentId,
                selector: x => new GroupDto
                {
                    Id = x.Id,
                    GroupCode = x.GroupCode,
                    GroupNameVn = x.GroupNameVn,
                    GroupNameJp = x.GroupNameJp,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department.DepartmentNameVn,
                    RequesterEmployeeId = x.RequesterEmployeeId,
                    RequesterFullName = x.RequesterEmployee != null ? $"{x.RequesterEmployee.LastName} {x.RequesterEmployee.FirstName}" : null,
                    ResponsibleEmployeeId = x.ResponsibleEmployeeId,
                    ResponsibleFullName = x.ResponsibleEmployee != null ? $"{x.ResponsibleEmployee.LastName} {x.ResponsibleEmployee.FirstName}" : null
                }
            );
            return groups.OrderBy(x => x.GroupNameVn).ToList();
        }

        public async Task<GroupDto> GetByIdAsync(int id)
        {
            var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == id, x => x.Department, x => x.RequesterEmployee!, x => x.ResponsibleEmployee!);
            group.OrThrowNotFound("Nhóm", id);

            return new GroupDto
            {
                Id = group!.Id,
                GroupCode = group.GroupCode,
                GroupNameVn = group.GroupNameVn,
                GroupNameJp = group.GroupNameJp,
                DepartmentId = group.DepartmentId,
                DepartmentNameVn = group.Department.DepartmentNameVn,
                RequesterEmployeeId = group.RequesterEmployeeId,
                RequesterFullName = group.RequesterEmployee != null ? $"{group.RequesterEmployee.LastName} {group.RequesterEmployee.FirstName}" : null,
                ResponsibleEmployeeId = group.ResponsibleEmployeeId,
                ResponsibleFullName = group.ResponsibleEmployee != null ? $"{group.ResponsibleEmployee.LastName} {group.ResponsibleEmployee.FirstName}" : null
            };
        }

        public async Task<GroupDto> CreateAsync(CreateGroupDto request)
        {
            var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == request.DepartmentId && !x.IsDeleted);
            department.OrThrowNotFound("Bộ phận", request.DepartmentId);

            var exists = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.GroupCode == request.GroupCode && !x.IsDeleted);
            if (exists != null) throw new DomainException($"Mã nhóm '{request.GroupCode}' đã tồn tại.");

            var newGroup = new Group
            {
                GroupCode = request.GroupCode,
                GroupNameVn = request.GroupNameVn,
                GroupNameJp = request.GroupNameJp,
                DepartmentId = request.DepartmentId,
                RequesterEmployeeId = request.RequesterEmployeeId,
                ResponsibleEmployeeId = request.ResponsibleEmployeeId,
                IsDeleted = false
            };

            await _unitOfWork.Groups.AddAsync(newGroup);
            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(newGroup.Id);
        }

        public async Task UpdateAsync(UpdateGroupDto request)
        {
            var group = await _unitOfWork.Groups.GetByIdAsync(request.Id);
            group.OrThrowNotFound("Nhóm", request.Id);

            if (group!.GroupCode != request.GroupCode)
            {
                var exists = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.GroupCode == request.GroupCode && !x.IsDeleted);
                if (exists != null) throw new DomainException($"Mã nhóm '{request.GroupCode}' đã tồn tại.");
            }

            if (group.DepartmentId != request.DepartmentId)
            {
                var department = await _unitOfWork.Departments.GetByIdAsync(request.DepartmentId);
                department.OrThrowNotFound("Bộ phận", request.DepartmentId);
            }

            group.GroupCode = request.GroupCode;
            group.GroupNameVn = request.GroupNameVn;
            group.GroupNameJp = request.GroupNameJp;
            group.DepartmentId = request.DepartmentId;
            group.RequesterEmployeeId = request.RequesterEmployeeId;
            group.ResponsibleEmployeeId = request.ResponsibleEmployeeId;

            _unitOfWork.Groups.Update(group);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var group = await _unitOfWork.Groups.GetByIdAsync(id);
            group.OrThrowNotFound("Nhóm", id);

            group!.IsDeleted = true;

            _unitOfWork.Groups.Update(group);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}

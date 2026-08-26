using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;
using Workflow.Application.Dtos.EmployeeOrgUnits;
using Workflow.Application.Dtos.Employees;
using Workflow.Application.Interfaces.Service;
using Workflow.Domain.Entities;

namespace Workflow.Application.Services
{
    public class EmployeeService : BaseService<IWorkflowUnitOfWork>, IEmployeeService
    {
        public EmployeeService(IWorkflowUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<EmployeeDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.Employees.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.EmployeeCode.Contains(keyword) || x.FullName.Contains(keyword));
            }

            return await _unitOfWork.Employees.ToPagedResponseAsync(
                query.OrderBy(x => x.FullName),
                pageIndex,
                pageSize,
                x => new EmployeeDto
                {
                    Id = x.Id,
                    EmployeeCode = x.EmployeeCode,
                    FullName = x.FullName,
                    FullNameJp = x.FullNameJp,
                    Email = x.Email,
                    Position = x.Position,
                    UserId = x.UserId,
                    IsActive = x.IsActive
                }
            );
        }

        public async Task<EmployeeDto> GetByIdAsync(int id)
        {
            var entity = (await _unitOfWork.Employees.GetByIdAsync(id)).OrThrowNotFound("Nhân sự", id);
            return ToDto(entity);
        }

        public async Task<EmployeeDto> CreateAsync(CreateEmployeeDto request)
        {
            var exists = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.EmployeeCode == request.EmployeeCode);
            exists.ThrowIfDuplicateCode("Mã nhân sự", request.EmployeeCode, x => x.IsDeleted);

            await GuardUserIdNotTakenAsync(request.UserId, currentEmployeeId: null);

            var entity = new Employee
            {
                EmployeeCode = request.EmployeeCode,
                FullName = request.FullName,
                FullNameJp = request.FullNameJp,
                Email = request.Email,
                Position = request.Position,
                UserId = request.UserId,
                IsActive = request.IsActive,
                IsDeleted = false
            };

            await _unitOfWork.Employees.AddAsync(entity);
            await _unitOfWork.SaveChangesAsync();

            return ToDto(entity);
        }

        public async Task UpdateAsync(UpdateEmployeeDto request)
        {
            var entity = (await _unitOfWork.Employees.GetByIdAsync(request.Id)).OrThrowNotFound("Nhân sự", request.Id);

            var exists = await _unitOfWork.Employees.FirstOrDefaultAsync(
                x => x.EmployeeCode == request.EmployeeCode && x.Id != request.Id);
            exists.ThrowIfDuplicateCode("Mã nhân sự", request.EmployeeCode, x => x.IsDeleted);

            await GuardUserIdNotTakenAsync(request.UserId, currentEmployeeId: request.Id);

            entity.EmployeeCode = request.EmployeeCode;
            entity.FullName = request.FullName;
            entity.FullNameJp = request.FullNameJp;
            entity.Email = request.Email;
            entity.Position = request.Position;
            entity.UserId = request.UserId;
            entity.IsActive = request.IsActive;

            _unitOfWork.Employees.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var entity = (await _unitOfWork.Employees.GetByIdAsync(id)).OrThrowNotFound("Nhân sự", id);

            var stillAssigned = await _unitOfWork.EmployeeOrgUnits.FirstOrDefaultAsync(x => x.EmployeeId == id && !x.IsDeleted);
            if (stillAssigned is not null)
                throw new DomainException("Không thể xóa nhân sự đang được gán vào đơn vị tổ chức.");

            entity.IsDeleted = true;

            _unitOfWork.Employees.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<List<EmployeeOrgUnitDto>> GetOrgUnitsAsync(int employeeId)
        {
            (await _unitOfWork.Employees.GetByIdAsync(employeeId)).OrThrowNotFound("Nhân sự", employeeId);

            var items = await _unitOfWork.EmployeeOrgUnits.FindWithIncludesAsync(
                x => x.EmployeeId == employeeId && !x.IsDeleted,
                x => x.OrgUnit,
                x => x.JobTitle!);

            return items
                .Select(x => new EmployeeOrgUnitDto
                {
                    Id = x.Id,
                    OrgUnitId = x.OrgUnitId,
                    OrgUnitCode = x.OrgUnit.Code,
                    OrgUnitNameVn = x.OrgUnit.NameVn,
                    JobTitleId = x.JobTitleId,
                    JobTitleNameVn = x.JobTitle?.NameVn,
                    IsPrimary = x.IsPrimary,
                    ValidFrom = x.ValidFrom,
                    ValidTo = x.ValidTo
                })
                .OrderByDescending(x => x.IsPrimary)
                .ThenBy(x => x.OrgUnitNameVn)
                .ToList();
        }

        public async Task<List<EmployeeOrgUnitDto>> ReplaceOrgUnitsAsync(int employeeId, ReplaceEmployeeOrgUnitsDto request)
        {
            (await _unitOfWork.Employees.GetByIdAsync(employeeId)).OrThrowNotFound("Nhân sự", employeeId);

            // workflow-module.md §3.1 EmployeeOrgUnits — validate ở Service (không dùng ràng buộc DB
            // vì có thời hiệu): tối đa 1 dòng IsPrimary=1 còn hiệu lực; 1 cặp (OrgUnitId, JobTitleId)
            // chỉ 1 người tại 1 thời điểm.
            if (request.Items.Count(x => x.IsPrimary) > 1)
                throw new DomainException("Chỉ được chọn tối đa 1 đơn vị chính cho mỗi nhân sự.");

            foreach (var item in request.Items)
            {
                (await _unitOfWork.OrgUnits.GetByIdAsync(item.OrgUnitId)).OrThrowNotFound("Đơn vị tổ chức", item.OrgUnitId);

                if (item.JobTitleId is not null)
                {
                    var jobTitle = (await _unitOfWork.JobTitles.GetByIdAsync(item.JobTitleId.Value)).OrThrowNotFound("Chức danh", item.JobTitleId.Value);

                    // Chỉ enforce "1 người/đơn vị" cho chức danh đánh dấu IsUniquePerOrgUnit — chức
                    // danh phổ thông (vd "Nhân viên") cho phép nhiều người cùng giữ (workflow-module.md
                    // §10, chốt 2026-08-26).
                    if (jobTitle.IsUniquePerOrgUnit)
                    {
                        var holder = await _unitOfWork.EmployeeOrgUnits.FirstOrDefaultAsync(x =>
                            x.OrgUnitId == item.OrgUnitId && x.JobTitleId == item.JobTitleId && !x.IsDeleted && x.EmployeeId != employeeId);
                        if (holder is not null)
                            throw new DomainException("Chức danh này tại đơn vị đã có người khác đang giữ.");
                    }
                }
            }

            var existing = await _unitOfWork.EmployeeOrgUnits.FindAsync(x => x.EmployeeId == employeeId && !x.IsDeleted);
            foreach (var item in existing)
            {
                _unitOfWork.EmployeeOrgUnits.Delete(item);
            }

            var newItems = request.Items
                .Select(item => new EmployeeOrgUnit
                {
                    EmployeeId = employeeId,
                    OrgUnitId = item.OrgUnitId,
                    JobTitleId = item.JobTitleId,
                    IsPrimary = item.IsPrimary,
                    ValidFrom = item.ValidFrom,
                    ValidTo = item.ValidTo,
                    IsDeleted = false
                })
                .ToList();

            await _unitOfWork.EmployeeOrgUnits.AddRangeAsync(newItems);
            await _unitOfWork.SaveChangesAsync();

            return await GetOrgUnitsAsync(employeeId);
        }

        private async Task GuardUserIdNotTakenAsync(int? userId, int? currentEmployeeId)
        {
            if (userId is null) return;

            var holder = await _unitOfWork.Employees.FirstOrDefaultAsync(x =>
                x.UserId == userId && !x.IsDeleted && x.Id != (currentEmployeeId ?? 0));
            if (holder is not null)
                throw new DomainException("Tài khoản đăng nhập này đã gắn với một nhân sự khác.");
        }

        private static EmployeeDto ToDto(Employee x) => new()
        {
            Id = x.Id,
            EmployeeCode = x.EmployeeCode,
            FullName = x.FullName,
            FullNameJp = x.FullNameJp,
            Email = x.Email,
            Position = x.Position,
            UserId = x.UserId,
            IsActive = x.IsActive
        };
    }
}

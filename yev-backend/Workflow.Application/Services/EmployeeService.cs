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

            var page = await _unitOfWork.Employees.ToPagedResponseAsync(
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

            var employeeIds = page.Data.Select(x => x.Id).ToList();
            var assignments = await _unitOfWork.EmployeeOrgUnits.FindWithIncludesAsync(
                x => employeeIds.Contains(x.EmployeeId) && !x.IsDeleted,
                x => x.OrgUnit,
                x => x.JobTitle!);

            var primaryByEmployee = assignments
                .GroupBy(x => x.EmployeeId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.IsPrimary).ThenBy(x => x.Id).First());

            foreach (var dto in page.Data)
            {
                if (!primaryByEmployee.TryGetValue(dto.Id, out var primary)) continue;
                dto.PrimaryOrgUnitNameVn = primary.OrgUnit.NameVn;
                dto.PrimaryJobTitleNameVn = primary.JobTitle?.NameVn;
            }

            return page;
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

            await ValidateOrgUnitItemsAsync(employeeId, request.Items);

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

        // Adds one assignment. The employee's first assignment becomes primary; marking a new one
        // primary clears the flag on the others.
        public async Task<List<EmployeeOrgUnitDto>> AddOrgUnitAsync(int employeeId, ReplaceEmployeeOrgUnitItemDto request)
        {
            (await _unitOfWork.Employees.GetByIdAsync(employeeId)).OrThrowNotFound("Nhân sự", employeeId);

            var existing = (await _unitOfWork.EmployeeOrgUnits.FindAsync(x => x.EmployeeId == employeeId && !x.IsDeleted)).ToList();
            if (existing.Any(x => x.OrgUnitId == request.OrgUnitId && x.JobTitleId == request.JobTitleId))
                throw new DomainException("Nhân sự đã được gán vào đơn vị này với cùng chức danh.");

            if (existing.Count == 0) request.IsPrimary = true;
            if (request.IsPrimary) ClearPrimary(existing);

            await ValidateOrgUnitItemsAsync(employeeId, existing.Select(ToItem).Append(request).ToList());

            await _unitOfWork.EmployeeOrgUnits.AddAsync(new EmployeeOrgUnit
            {
                EmployeeId = employeeId,
                OrgUnitId = request.OrgUnitId,
                JobTitleId = request.JobTitleId,
                IsPrimary = request.IsPrimary,
                ValidFrom = request.ValidFrom,
                ValidTo = request.ValidTo,
                IsDeleted = false
            });
            await _unitOfWork.SaveChangesAsync();

            return await GetOrgUnitsAsync(employeeId);
        }

        // Updates one assignment (move unit, change job title, set primary). The row keeps its own
        // ValidFrom/ValidTo; the request's date fields are ignored.
        public async Task<List<EmployeeOrgUnitDto>> UpdateOrgUnitAsync(int assignmentId, ReplaceEmployeeOrgUnitItemDto request)
        {
            var row = (await _unitOfWork.EmployeeOrgUnits.GetByIdAsync(assignmentId)).OrThrowNotFound("Dòng gán đơn vị", assignmentId);
            if (row.IsDeleted) throw new NotFoundException("Dòng gán đơn vị", assignmentId);

            request.ValidFrom = row.ValidFrom;
            request.ValidTo = row.ValidTo;

            var employeeId = row.EmployeeId;
            var others = (await _unitOfWork.EmployeeOrgUnits.FindAsync(x => x.EmployeeId == employeeId && !x.IsDeleted && x.Id != assignmentId)).ToList();
            if (others.Any(x => x.OrgUnitId == request.OrgUnitId && x.JobTitleId == request.JobTitleId))
                throw new DomainException("Nhân sự đã được gán vào đơn vị này với cùng chức danh.");

            if (request.IsPrimary) ClearPrimary(others);

            await ValidateOrgUnitItemsAsync(employeeId, others.Select(ToItem).Append(request).ToList());

            row.OrgUnitId = request.OrgUnitId;
            row.JobTitleId = request.JobTitleId;
            row.IsPrimary = request.IsPrimary;
            row.ValidFrom = request.ValidFrom;
            row.ValidTo = request.ValidTo;
            _unitOfWork.EmployeeOrgUnits.Update(row);
            await _unitOfWork.SaveChangesAsync();

            return await GetOrgUnitsAsync(employeeId);
        }

        public async Task RemoveOrgUnitAsync(int assignmentId)
        {
            var row = (await _unitOfWork.EmployeeOrgUnits.GetByIdAsync(assignmentId)).OrThrowNotFound("Dòng gán đơn vị", assignmentId);
            if (row.IsDeleted) throw new NotFoundException("Dòng gán đơn vị", assignmentId);

            _unitOfWork.EmployeeOrgUnits.Delete(row);
            await _unitOfWork.SaveChangesAsync();
        }

        private void ClearPrimary(IEnumerable<EmployeeOrgUnit> rows)
        {
            foreach (var row in rows.Where(x => x.IsPrimary))
            {
                row.IsPrimary = false;
                _unitOfWork.EmployeeOrgUnits.Update(row);
            }
        }

        private static ReplaceEmployeeOrgUnitItemDto ToItem(EmployeeOrgUnit x) => new()
        {
            OrgUnitId = x.OrgUnitId,
            JobTitleId = x.JobTitleId,
            IsPrimary = x.IsPrimary,
            ValidFrom = x.ValidFrom,
            ValidTo = x.ValidTo
        };

        // workflow-module.md §3.1 EmployeeOrgUnits: at most one overlapping primary row per employee,
        // and a unique-per-unit job title has at most one holder at any moment. Both compare
        // ValidFrom/ValidTo ranges, not just "valid right now".
        private async Task ValidateOrgUnitItemsAsync(int employeeId, IReadOnlyList<ReplaceEmployeeOrgUnitItemDto> items)
        {
            var primaryItems = items.Where(x => x.IsPrimary).ToList();
            for (var i = 0; i < primaryItems.Count; i++)
            {
                for (var j = i + 1; j < primaryItems.Count; j++)
                {
                    if (DateRangesOverlap(primaryItems[i].ValidFrom, primaryItems[i].ValidTo, primaryItems[j].ValidFrom, primaryItems[j].ValidTo))
                        throw new DomainException("Có 2 đơn vị chính chồng khoảng thời gian hiệu lực — chỉ được 1 đơn vị chính tại 1 thời điểm.");
                }
            }

            var orgUnitIds = items.Select(x => x.OrgUnitId).Distinct().ToList();
            var existingOrgUnitIds = (await _unitOfWork.OrgUnits.SelectAsync(x => orgUnitIds.Contains(x.Id), x => x.Id)).ToHashSet();

            var jobTitleIds = items.Where(x => x.JobTitleId is not null).Select(x => x.JobTitleId!.Value).Distinct().ToList();
            var jobTitlesById = jobTitleIds.Count == 0
                ? new Dictionary<int, JobTitle>()
                : (await _unitOfWork.JobTitles.FindAsync(x => jobTitleIds.Contains(x.Id))).ToDictionary(x => x.Id);

            // Only job titles flagged IsUniquePerOrgUnit are limited to one holder per unit.
            var uniqueJobTitleIds = jobTitlesById.Values.Where(x => x.IsUniquePerOrgUnit).Select(x => x.Id).ToList();
            var otherHolders = uniqueJobTitleIds.Count == 0
                ? new List<EmployeeOrgUnit>()
                : (await _unitOfWork.EmployeeOrgUnits.FindAsync(x =>
                    orgUnitIds.Contains(x.OrgUnitId) && x.JobTitleId != null && uniqueJobTitleIds.Contains(x.JobTitleId.Value)
                    && !x.IsDeleted && x.EmployeeId != employeeId)).ToList();

            foreach (var item in items)
            {
                if (item.ValidFrom is not null && item.ValidTo is not null && item.ValidTo < item.ValidFrom)
                    throw new DomainException("Ngày kết thúc hiệu lực phải sau ngày bắt đầu.");

                if (!existingOrgUnitIds.Contains(item.OrgUnitId))
                    throw new NotFoundException("Đơn vị tổ chức", item.OrgUnitId);

                if (item.JobTitleId is null) continue;

                if (!jobTitlesById.TryGetValue(item.JobTitleId.Value, out var jobTitle))
                    throw new NotFoundException("Chức danh", item.JobTitleId.Value);

                if (!jobTitle.IsUniquePerOrgUnit) continue;

                if (otherHolders.Any(h => h.OrgUnitId == item.OrgUnitId && h.JobTitleId == item.JobTitleId
                        && DateRangesOverlap(h.ValidFrom, h.ValidTo, item.ValidFrom, item.ValidTo)))
                    throw new DomainException("Chức danh này tại đơn vị đã có người khác đang giữ trong cùng khoảng thời gian.");
            }
        }

        // Null bound means "open-ended" on that side.
        private static bool DateRangesOverlap(DateTime? aFrom, DateTime? aTo, DateTime? bFrom, DateTime? bTo) =>
            (aFrom is null || bTo is null || aFrom <= bTo) && (bFrom is null || aTo is null || bFrom <= aTo);

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

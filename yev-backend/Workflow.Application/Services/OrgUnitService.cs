using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;
using Workflow.Application.Dtos.OrgUnits;
using Workflow.Application.Interfaces.Service;
using Workflow.Domain.Entities;

namespace Workflow.Application.Services
{
    public class OrgUnitService : BaseService<IWorkflowUnitOfWork>, IOrgUnitService
    {
        public OrgUnitService(IWorkflowUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<OrgUnitDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.OrgUnits.GetQueryable(false, x => x.OrgLevel, x => x.Parent!).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.Code.Contains(keyword) || x.NameVn.Contains(keyword));
            }

            return await _unitOfWork.OrgUnits.ToPagedResponseAsync(
                query.OrderBy(x => x.SortOrder).ThenBy(x => x.Code),
                pageIndex,
                pageSize,
                x => new OrgUnitDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    NameVn = x.NameVn,
                    NameJp = x.NameJp,
                    OrgLevelId = x.OrgLevelId,
                    OrgLevelNameVn = x.OrgLevel.NameVn,
                    ParentId = x.ParentId,
                    ParentNameVn = x.Parent != null ? x.Parent.NameVn : null,
                    SortOrder = x.SortOrder,
                    ValidFrom = x.ValidFrom,
                    ValidTo = x.ValidTo
                }
            );
        }

        public async Task<List<OrgUnitTreeDto>> GetTreeAsync()
        {
            var units = await _unitOfWork.OrgUnits.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new OrgUnitTreeDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    NameVn = x.NameVn,
                    NameJp = x.NameJp,
                    OrgLevelId = x.OrgLevelId,
                    SortOrder = x.SortOrder
                });

            // ParentId is loaded separately (not part of the projection above) since it is only needed
            // here to link nodes, not to render each node.
            var parentLookup = (await _unitOfWork.OrgUnits.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new { x.Id, x.ParentId })).ToDictionary(x => x.Id, x => x.ParentId);

            // Members loaded with the tree so admins see who holds which position; active employees only.
            var memberRows = await _unitOfWork.EmployeeOrgUnits.FindWithIncludesAsync(
                x => !x.IsDeleted && !x.Employee.IsDeleted && x.Employee.IsActive,
                x => x.Employee, x => x.JobTitle!);

            var membersByOrgUnit = memberRows
                .GroupBy(x => x.OrgUnitId)
                .ToDictionary(
                    g => g.Key,
                    g => g
                        .OrderBy(x => x.JobTitle != null ? x.JobTitle.RankOrder : int.MaxValue)
                        .ThenBy(x => x.Employee.FullName)
                        .Select(x => new OrgUnitTreeMemberDto
                        {
                            AssignmentId = x.Id,
                            EmployeeId = x.EmployeeId,
                            EmployeeFullName = x.Employee.FullName,
                            EmployeeCode = x.Employee.EmployeeCode,
                            JobTitleId = x.JobTitleId,
                            JobTitleNameVn = x.JobTitle?.NameVn,
                            JobTitleRankOrder = x.JobTitle != null ? x.JobTitle.RankOrder : null,
                            IsPrimary = x.IsPrimary
                        })
                        .ToList());

            var byId = units.ToDictionary(x => x.Id);
            foreach (var unit in units)
            {
                if (membersByOrgUnit.TryGetValue(unit.Id, out var members))
                    unit.Members = members;
            }
            var roots = new List<OrgUnitTreeDto>();

            foreach (var unit in units)
            {
                var parentId = parentLookup[unit.Id];
                if (parentId is not null && byId.TryGetValue(parentId.Value, out var parent))
                {
                    parent.Children.Add(unit);
                }
                else
                {
                    roots.Add(unit);
                }
            }

            SortTree(roots);
            return roots;
        }

        private static void SortTree(List<OrgUnitTreeDto> nodes)
        {
            nodes.Sort((a, b) => a.SortOrder != b.SortOrder ? a.SortOrder.CompareTo(b.SortOrder) : string.CompareOrdinal(a.Code, b.Code));
            foreach (var node in nodes)
            {
                SortTree(node.Children);
            }
        }

        public async Task<OrgUnitDto> GetByIdAsync(int id)
        {
            var entity = (await _unitOfWork.OrgUnits.FirstOrDefaultAsync(x => x.Id == id, x => x.OrgLevel, x => x.Parent!))
                .OrThrowNotFound("Đơn vị tổ chức", id);
            return ToDto(entity);
        }

        public async Task<OrgUnitDto> CreateAsync(CreateOrgUnitDto request)
        {
            var exists = await _unitOfWork.OrgUnits.FirstOrDefaultAsync(x => x.Code == request.Code);
            exists.ThrowIfDuplicateCode("Mã đơn vị", request.Code, x => x.IsDeleted);

            (await _unitOfWork.OrgLevels.GetByIdAsync(request.OrgLevelId)).OrThrowNotFound("Cấp tổ chức", request.OrgLevelId);

            if (request.ParentId is not null)
            {
                (await _unitOfWork.OrgUnits.GetByIdAsync(request.ParentId.Value)).OrThrowNotFound("Đơn vị cha", request.ParentId.Value);
            }

            var entity = new OrgUnit
            {
                Code = request.Code,
                NameVn = request.NameVn,
                NameJp = request.NameJp,
                OrgLevelId = request.OrgLevelId,
                ParentId = request.ParentId,
                SortOrder = request.SortOrder,
                ValidFrom = request.ValidFrom,
                ValidTo = request.ValidTo,
                IsDeleted = false
            };

            await _unitOfWork.OrgUnits.AddAsync(entity);
            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(entity.Id);
        }

        public async Task UpdateAsync(UpdateOrgUnitDto request)
        {
            var entity = (await _unitOfWork.OrgUnits.GetByIdAsync(request.Id)).OrThrowNotFound("Đơn vị tổ chức", request.Id);

            var exists = await _unitOfWork.OrgUnits.FirstOrDefaultAsync(
                x => x.Code == request.Code && x.Id != request.Id);
            exists.ThrowIfDuplicateCode("Mã đơn vị", request.Code, x => x.IsDeleted);

            (await _unitOfWork.OrgLevels.GetByIdAsync(request.OrgLevelId)).OrThrowNotFound("Cấp tổ chức", request.OrgLevelId);

            if (request.ParentId is not null)
            {
                if (request.ParentId == request.Id)
                    throw new DomainException("Đơn vị không thể là cha của chính nó.");

                (await _unitOfWork.OrgUnits.GetByIdAsync(request.ParentId.Value)).OrThrowNotFound("Đơn vị cha", request.ParentId.Value);

                await GuardAgainstCycleAsync(request.Id, request.ParentId.Value);
            }

            entity.Code = request.Code;
            entity.NameVn = request.NameVn;
            entity.NameJp = request.NameJp;
            entity.OrgLevelId = request.OrgLevelId;
            entity.ParentId = request.ParentId;
            entity.SortOrder = request.SortOrder;
            entity.ValidFrom = request.ValidFrom;
            entity.ValidTo = request.ValidTo;

            _unitOfWork.OrgUnits.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var entity = (await _unitOfWork.OrgUnits.GetByIdAsync(id)).OrThrowNotFound("Đơn vị tổ chức", id);

            var hasChildren = await _unitOfWork.OrgUnits.FirstOrDefaultAsync(x => x.ParentId == id && !x.IsDeleted);
            if (hasChildren is not null)
                throw new DomainException("Không thể xóa đơn vị đang có đơn vị con.");

            var hasEmployees = await _unitOfWork.EmployeeOrgUnits.FirstOrDefaultAsync(x => x.OrgUnitId == id && !x.IsDeleted);
            if (hasEmployees is not null)
                throw new DomainException("Không thể xóa đơn vị đang có nhân sự trực thuộc.");

            entity.IsDeleted = true;

            _unitOfWork.OrgUnits.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task ReorderAsync(ReorderOrgUnitDto request)
        {
            // The tree is small, so it is loaded once; tracked entities keep earlier items' ParentId
            // changes visible to the cycle check of later items.
            var unitsById = (await _unitOfWork.OrgUnits.GetAllAsync()).ToDictionary(x => x.Id);

            foreach (var item in request.Items)
            {
                if (!unitsById.TryGetValue(item.Id, out var entity))
                    throw new NotFoundException("Đơn vị tổ chức", item.Id);

                if (item.ParentId is not null)
                {
                    if (item.ParentId == item.Id)
                        throw new DomainException("Đơn vị không thể là cha của chính nó.");

                    if (!unitsById.ContainsKey(item.ParentId.Value))
                        throw new NotFoundException("Đơn vị cha", item.ParentId.Value);

                    GuardAgainstCycle(unitsById, item.Id, item.ParentId.Value);
                }

                entity.ParentId = item.ParentId;
                entity.SortOrder = item.SortOrder;

                _unitOfWork.OrgUnits.Update(entity);
            }

            await _unitOfWork.SaveChangesAsync();
        }

        private static void GuardAgainstCycle(IReadOnlyDictionary<int, OrgUnit> unitsById, int movingId, int newParentId)
        {
            var cursor = newParentId;
            var guard = 0;
            while (guard++ < 1000)
            {
                if (cursor == movingId)
                    throw new DomainException("Không thể chuyển đơn vị vào chính đơn vị con/cháu của nó.");

                if (!unitsById.TryGetValue(cursor, out var parent) || parent.ParentId is null) return;
                cursor = parent.ParentId.Value;
            }
        }

        private async Task GuardAgainstCycleAsync(int movingId, int newParentId)
        {
            var cursor = newParentId;
            var guard = 0;
            while (guard++ < 1000)
            {
                if (cursor == movingId)
                    throw new DomainException("Không thể chuyển đơn vị vào chính đơn vị con/cháu của nó.");

                var parent = await _unitOfWork.OrgUnits.GetByIdAsync(cursor);
                if (parent is null || parent.ParentId is null) return;
                cursor = parent.ParentId.Value;
            }
        }

        private static OrgUnitDto ToDto(OrgUnit x) => new()
        {
            Id = x.Id,
            Code = x.Code,
            NameVn = x.NameVn,
            NameJp = x.NameJp,
            OrgLevelId = x.OrgLevelId,
            OrgLevelNameVn = x.OrgLevel?.NameVn ?? "",
            ParentId = x.ParentId,
            ParentNameVn = x.Parent?.NameVn,
            SortOrder = x.SortOrder,
            ValidFrom = x.ValidFrom,
            ValidTo = x.ValidTo
        };
    }
}

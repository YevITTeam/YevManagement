using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;
using Workflow.Application.Dtos.FormCategories;
using Workflow.Application.Dtos.FormCategoryCoordinators;
using Workflow.Application.Interfaces.Service;
using Workflow.Domain.Entities;

namespace Workflow.Application.Services
{
    public class FormCategoryService : BaseService<IWorkflowUnitOfWork>, IFormCategoryService
    {
        public FormCategoryService(IWorkflowUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<FormCategoryDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.FormCategories.GetQueryable(false, x => x.OrgUnit!).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.Code.Contains(keyword) || x.NameVn.Contains(keyword));
            }

            return await _unitOfWork.FormCategories.ToPagedResponseAsync(
                query.OrderBy(x => x.SortOrder).ThenBy(x => x.Code),
                pageIndex,
                pageSize,
                x => new FormCategoryDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    NameVn = x.NameVn,
                    NameJp = x.NameJp,
                    OrgUnitId = x.OrgUnitId,
                    OrgUnitNameVn = x.OrgUnit != null ? x.OrgUnit.NameVn : null,
                    SortOrder = x.SortOrder
                }
            );
        }

        public async Task<List<FormCategoryDto>> GetAllActiveAsync()
        {
            var items = await _unitOfWork.FormCategories.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new FormCategoryDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    NameVn = x.NameVn,
                    NameJp = x.NameJp,
                    OrgUnitId = x.OrgUnitId,
                    OrgUnitNameVn = x.OrgUnit != null ? x.OrgUnit.NameVn : null,
                    SortOrder = x.SortOrder
                });
            return items.OrderBy(x => x.SortOrder).ThenBy(x => x.Code).ToList();
        }

        public async Task<FormCategoryDto> GetByIdAsync(int id)
        {
            var entity = (await _unitOfWork.FormCategories.FirstOrDefaultAsync(x => x.Id == id, x => x.OrgUnit!))
                .OrThrowNotFound("Danh mục form", id);
            return ToDto(entity);
        }

        public async Task<FormCategoryDto> CreateAsync(CreateFormCategoryDto request)
        {
            var exists = await _unitOfWork.FormCategories.FirstOrDefaultAsync(x => x.Code == request.Code);
            exists.ThrowIfDuplicateCode("Mã danh mục", request.Code, x => x.IsDeleted);

            if (request.OrgUnitId is not null)
            {
                (await _unitOfWork.OrgUnits.GetByIdAsync(request.OrgUnitId.Value)).OrThrowNotFound("Đơn vị tổ chức", request.OrgUnitId.Value);
            }

            var entity = new FormCategory
            {
                Code = request.Code,
                NameVn = request.NameVn,
                NameJp = request.NameJp,
                OrgUnitId = request.OrgUnitId,
                SortOrder = request.SortOrder,
                IsDeleted = false
            };

            await _unitOfWork.FormCategories.AddAsync(entity);
            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(entity.Id);
        }

        public async Task UpdateAsync(UpdateFormCategoryDto request)
        {
            var entity = (await _unitOfWork.FormCategories.GetByIdAsync(request.Id)).OrThrowNotFound("Danh mục form", request.Id);

            var exists = await _unitOfWork.FormCategories.FirstOrDefaultAsync(
                x => x.Code == request.Code && x.Id != request.Id);
            exists.ThrowIfDuplicateCode("Mã danh mục", request.Code, x => x.IsDeleted);

            if (request.OrgUnitId is not null)
            {
                (await _unitOfWork.OrgUnits.GetByIdAsync(request.OrgUnitId.Value)).OrThrowNotFound("Đơn vị tổ chức", request.OrgUnitId.Value);
            }

            entity.Code = request.Code;
            entity.NameVn = request.NameVn;
            entity.NameJp = request.NameJp;
            entity.OrgUnitId = request.OrgUnitId;
            entity.SortOrder = request.SortOrder;

            _unitOfWork.FormCategories.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var entity = (await _unitOfWork.FormCategories.GetByIdAsync(id)).OrThrowNotFound("Danh mục form", id);

            // FormDefinitions chưa scaffold ở Pha 2A (workflow-module.md §8 Pha 2B) — chưa có gì để
            // check "còn form đang dùng danh mục này" ở đây. Bổ sung guard này khi FormDefinitions có.
            entity.IsDeleted = true;

            _unitOfWork.FormCategories.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<List<FormCategoryCoordinatorDto>> GetCoordinatorsAsync(int formCategoryId)
        {
            (await _unitOfWork.FormCategories.GetByIdAsync(formCategoryId)).OrThrowNotFound("Danh mục form", formCategoryId);

            var items = await _unitOfWork.FormCategoryCoordinators.FindWithIncludesAsync(
                x => x.FormCategoryId == formCategoryId && !x.IsDeleted,
                x => x.Employee);

            return items
                .Select(x => new FormCategoryCoordinatorDto
                {
                    Id = x.Id,
                    EmployeeId = x.EmployeeId,
                    EmployeeCode = x.Employee.EmployeeCode,
                    EmployeeFullName = x.Employee.FullName
                })
                .OrderBy(x => x.EmployeeFullName)
                .ToList();
        }

        public async Task<List<FormCategoryCoordinatorDto>> ReplaceCoordinatorsAsync(int formCategoryId, ReplaceFormCategoryCoordinatorsDto request)
        {
            (await _unitOfWork.FormCategories.GetByIdAsync(formCategoryId)).OrThrowNotFound("Danh mục form", formCategoryId);

            var distinctEmployeeIds = request.EmployeeIds.Distinct().ToList();

            foreach (var employeeId in distinctEmployeeIds)
            {
                (await _unitOfWork.Employees.GetByIdAsync(employeeId)).OrThrowNotFound("Nhân sự", employeeId);
            }

            var existing = await _unitOfWork.FormCategoryCoordinators.FindAsync(x => x.FormCategoryId == formCategoryId && !x.IsDeleted);
            foreach (var item in existing)
            {
                _unitOfWork.FormCategoryCoordinators.Delete(item);
            }

            var newItems = distinctEmployeeIds
                .Select(employeeId => new FormCategoryCoordinator
                {
                    FormCategoryId = formCategoryId,
                    EmployeeId = employeeId,
                    IsDeleted = false
                })
                .ToList();

            await _unitOfWork.FormCategoryCoordinators.AddRangeAsync(newItems);
            await _unitOfWork.SaveChangesAsync();

            return await GetCoordinatorsAsync(formCategoryId);
        }

        private static FormCategoryDto ToDto(FormCategory x) => new()
        {
            Id = x.Id,
            Code = x.Code,
            NameVn = x.NameVn,
            NameJp = x.NameJp,
            OrgUnitId = x.OrgUnitId,
            OrgUnitNameVn = x.OrgUnit?.NameVn,
            SortOrder = x.SortOrder
        };
    }
}

using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;
using Workflow.Application.Dtos.OrgLevels;
using Workflow.Application.Interfaces.Service;
using Workflow.Domain.Entities;

namespace Workflow.Application.Services
{
    public class OrgLevelService : BaseService<IWorkflowUnitOfWork>, IOrgLevelService
    {
        public OrgLevelService(IWorkflowUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<OrgLevelDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.OrgLevels.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.NameVn.Contains(keyword) || (x.NameJp != null && x.NameJp.Contains(keyword)));
            }

            return await _unitOfWork.OrgLevels.ToPagedResponseAsync(
                query.OrderBy(x => x.LevelNumber),
                pageIndex,
                pageSize,
                x => new OrgLevelDto { Id = x.Id, LevelNumber = x.LevelNumber, NameVn = x.NameVn, NameJp = x.NameJp }
            );
        }

        public async Task<List<OrgLevelDto>> GetAllActiveAsync()
        {
            var items = await _unitOfWork.OrgLevels.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new OrgLevelDto { Id = x.Id, LevelNumber = x.LevelNumber, NameVn = x.NameVn, NameJp = x.NameJp }
            );
            return items.OrderBy(x => x.LevelNumber).ToList();
        }

        public async Task<OrgLevelDto> GetByIdAsync(int id)
        {
            var entity = (await _unitOfWork.OrgLevels.GetByIdAsync(id)).OrThrowNotFound("Cấp tổ chức", id);
            return new OrgLevelDto { Id = entity.Id, LevelNumber = entity.LevelNumber, NameVn = entity.NameVn, NameJp = entity.NameJp };
        }

        public async Task<OrgLevelDto> CreateAsync(CreateOrgLevelDto request)
        {
            var exists = await _unitOfWork.OrgLevels.FirstOrDefaultAsync(x => x.LevelNumber == request.LevelNumber);
            if (exists is not null)
            {
                throw new DomainException(exists.IsDeleted
                    ? $"Số cấp '{request.LevelNumber}' đang thuộc một bản ghi đã xóa nên không dùng lại được."
                    : $"Số cấp '{request.LevelNumber}' đã tồn tại.");
            }

            var entity = new OrgLevel
            {
                LevelNumber = request.LevelNumber,
                NameVn = request.NameVn,
                NameJp = request.NameJp,
                IsDeleted = false
            };

            await _unitOfWork.OrgLevels.AddAsync(entity);
            await _unitOfWork.SaveChangesAsync();

            return new OrgLevelDto { Id = entity.Id, LevelNumber = entity.LevelNumber, NameVn = entity.NameVn, NameJp = entity.NameJp };
        }

        public async Task UpdateAsync(UpdateOrgLevelDto request)
        {
            var entity = (await _unitOfWork.OrgLevels.GetByIdAsync(request.Id)).OrThrowNotFound("Cấp tổ chức", request.Id);

            var exists = await _unitOfWork.OrgLevels.FirstOrDefaultAsync(
                x => x.LevelNumber == request.LevelNumber && x.Id != request.Id);
            if (exists is not null)
            {
                throw new DomainException(exists.IsDeleted
                    ? $"Số cấp '{request.LevelNumber}' đang thuộc một bản ghi đã xóa nên không dùng lại được."
                    : $"Số cấp '{request.LevelNumber}' đã tồn tại.");
            }

            entity.LevelNumber = request.LevelNumber;
            entity.NameVn = request.NameVn;
            entity.NameJp = request.NameJp;

            _unitOfWork.OrgLevels.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var entity = (await _unitOfWork.OrgLevels.GetByIdAsync(id)).OrThrowNotFound("Cấp tổ chức", id);

            var stillUsed = await _unitOfWork.OrgUnits.FirstOrDefaultAsync(x => x.OrgLevelId == id && !x.IsDeleted);
            if (stillUsed is not null)
                throw new DomainException("Không thể xóa cấp tổ chức đang được đơn vị sử dụng.");

            entity.IsDeleted = true;

            _unitOfWork.OrgLevels.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<List<OrgLevelJobTitleSuggestionDto>> GetJobTitleSuggestionsAsync(int orgLevelId)
        {
            (await _unitOfWork.OrgLevels.GetByIdAsync(orgLevelId)).OrThrowNotFound("Cấp tổ chức", orgLevelId);

            var items = await _unitOfWork.OrgLevelJobTitleSuggestions.FindWithIncludesAsync(
                x => x.OrgLevelId == orgLevelId && !x.IsDeleted,
                x => x.JobTitle);

            return items
                .OrderBy(x => x.SortOrder)
                .Select(x => new OrgLevelJobTitleSuggestionDto
                {
                    JobTitleId = x.JobTitleId,
                    JobTitleCode = x.JobTitle.Code,
                    JobTitleNameVn = x.JobTitle.NameVn,
                    JobTitleNameJp = x.JobTitle.NameJp,
                    SortOrder = x.SortOrder
                })
                .ToList();
        }

        public async Task<List<OrgLevelJobTitleSuggestionDto>> ReplaceJobTitleSuggestionsAsync(int orgLevelId, ReplaceOrgLevelJobTitleSuggestionsDto request)
        {
            (await _unitOfWork.OrgLevels.GetByIdAsync(orgLevelId)).OrThrowNotFound("Cấp tổ chức", orgLevelId);

            var distinctJobTitleIds = request.JobTitleIds.Distinct().ToList();

            var existingJobTitleIds = (await _unitOfWork.JobTitles.SelectAsync(x => distinctJobTitleIds.Contains(x.Id), x => x.Id)).ToHashSet();
            var missingJobTitleIds = distinctJobTitleIds.Where(id => !existingJobTitleIds.Contains(id)).ToList();
            if (missingJobTitleIds.Count > 0)
                throw new NotFoundException("Chức danh", missingJobTitleIds[0]);

            var existing = await _unitOfWork.OrgLevelJobTitleSuggestions.FindAsync(x => x.OrgLevelId == orgLevelId && !x.IsDeleted);
            foreach (var item in existing)
            {
                _unitOfWork.OrgLevelJobTitleSuggestions.Delete(item);
            }

            var newItems = distinctJobTitleIds
                .Select((jobTitleId, index) => new OrgLevelJobTitleSuggestion
                {
                    OrgLevelId = orgLevelId,
                    JobTitleId = jobTitleId,
                    SortOrder = index,
                    IsDeleted = false
                })
                .ToList();

            await _unitOfWork.OrgLevelJobTitleSuggestions.AddRangeAsync(newItems);
            await _unitOfWork.SaveChangesAsync();

            return await GetJobTitleSuggestionsAsync(orgLevelId);
        }
    }
}

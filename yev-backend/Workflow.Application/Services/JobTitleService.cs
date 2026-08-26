using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;
using Workflow.Application.Dtos.JobTitles;
using Workflow.Application.Interfaces.Service;
using Workflow.Domain.Entities;

namespace Workflow.Application.Services
{
    public class JobTitleService : BaseService<IWorkflowUnitOfWork>, IJobTitleService
    {
        public JobTitleService(IWorkflowUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<JobTitleDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.JobTitles.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.Code.Contains(keyword) || x.NameVn.Contains(keyword));
            }

            return await _unitOfWork.JobTitles.ToPagedResponseAsync(
                query.OrderBy(x => x.RankOrder),
                pageIndex,
                pageSize,
                x => new JobTitleDto { Id = x.Id, Code = x.Code, NameVn = x.NameVn, NameJp = x.NameJp, RankOrder = x.RankOrder, IsUniquePerOrgUnit = x.IsUniquePerOrgUnit }
            );
        }

        public async Task<List<JobTitleDto>> GetAllActiveAsync()
        {
            var items = await _unitOfWork.JobTitles.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new JobTitleDto { Id = x.Id, Code = x.Code, NameVn = x.NameVn, NameJp = x.NameJp, RankOrder = x.RankOrder }
            );
            return items.OrderBy(x => x.RankOrder).ToList();
        }

        public async Task<JobTitleDto> GetByIdAsync(int id)
        {
            var entity = (await _unitOfWork.JobTitles.GetByIdAsync(id)).OrThrowNotFound("Chức danh", id);
            return new JobTitleDto { Id = entity.Id, Code = entity.Code, NameVn = entity.NameVn, NameJp = entity.NameJp, RankOrder = entity.RankOrder, IsUniquePerOrgUnit = entity.IsUniquePerOrgUnit };
        }

        public async Task<JobTitleDto> CreateAsync(CreateJobTitleDto request)
        {
            var exists = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.Code == request.Code);
            exists.ThrowIfDuplicateCode("Mã chức danh", request.Code, x => x.IsDeleted);

            var entity = new JobTitle
            {
                Code = request.Code,
                NameVn = request.NameVn,
                NameJp = request.NameJp,
                RankOrder = request.RankOrder,
                IsUniquePerOrgUnit = request.IsUniquePerOrgUnit,
                IsDeleted = false
            };

            await _unitOfWork.JobTitles.AddAsync(entity);
            await _unitOfWork.SaveChangesAsync();

            return new JobTitleDto { Id = entity.Id, Code = entity.Code, NameVn = entity.NameVn, NameJp = entity.NameJp, RankOrder = entity.RankOrder, IsUniquePerOrgUnit = entity.IsUniquePerOrgUnit };
        }

        public async Task UpdateAsync(UpdateJobTitleDto request)
        {
            var entity = (await _unitOfWork.JobTitles.GetByIdAsync(request.Id)).OrThrowNotFound("Chức danh", request.Id);

            var exists = await _unitOfWork.JobTitles.FirstOrDefaultAsync(
                x => x.Code == request.Code && x.Id != request.Id);
            exists.ThrowIfDuplicateCode("Mã chức danh", request.Code, x => x.IsDeleted);

            entity.Code = request.Code;
            entity.NameVn = request.NameVn;
            entity.NameJp = request.NameJp;
            entity.RankOrder = request.RankOrder;
            entity.IsUniquePerOrgUnit = request.IsUniquePerOrgUnit;

            _unitOfWork.JobTitles.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var entity = (await _unitOfWork.JobTitles.GetByIdAsync(id)).OrThrowNotFound("Chức danh", id);

            var stillUsed = await _unitOfWork.EmployeeOrgUnits.FirstOrDefaultAsync(x => x.JobTitleId == id && !x.IsDeleted);
            if (stillUsed is not null)
                throw new DomainException("Không thể xóa chức danh đang được gán cho nhân sự.");

            entity.IsDeleted = true;

            _unitOfWork.JobTitles.Update(entity);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}

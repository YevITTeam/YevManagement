using Asset.Application.Dtos.Branches;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Shared.Application.Abstractions;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Services
{
    public class BranchService : BaseService<IAssetUnitOfWork>, IBranchService
    {
        public BranchService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<BranchDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.Branches.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.BranchCode.Contains(keyword) || x.BranchName.Contains(keyword));
            }

            return await _unitOfWork.Branches.ToPagedResponseAsync(
                query.OrderBy(x => x.BranchCode),
                pageIndex,
                pageSize,
                x => new BranchDto { Id = x.Id, BranchCode = x.BranchCode, BranchName = x.BranchName }
            );
        }

        public async Task<List<BranchDto>> GetAllActiveAsync()
        {
            var branches = await _unitOfWork.Branches.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new BranchDto { Id = x.Id, BranchCode = x.BranchCode, BranchName = x.BranchName }
            );
            return branches.OrderBy(x => x.BranchName).ToList();
        }

        public async Task<BranchDto> GetByIdAsync(int id)
        {
            var branch = await _unitOfWork.Branches.GetByIdAsync(id);
            branch.OrThrowNotFound("Chi nhánh", id);

            return new BranchDto { Id = branch.Id, BranchCode = branch.BranchCode, BranchName = branch.BranchName };
        }

        public async Task<BranchDto> CreateAsync(CreateBranchDto request)
        {
            var exists = await _unitOfWork.Branches.FirstOrDefaultAsync(x => x.BranchCode == request.BranchCode && !x.IsDeleted);
            if (exists != null) throw new DomainException($"Mã chi nhánh '{request.BranchCode}' đã tồn tại.");

            var newBranch = new Branch
            {
                BranchCode = request.BranchCode,
                BranchName = request.BranchName,
                IsDeleted = false
            };

            await _unitOfWork.Branches.AddAsync(newBranch);
            await _unitOfWork.SaveChangesAsync();

            return new BranchDto { Id = newBranch.Id, BranchCode = newBranch.BranchCode, BranchName = newBranch.BranchName };
        }

        public async Task UpdateAsync(UpdateBranchDto request)
        {
            var branch = await _unitOfWork.Branches.GetByIdAsync(request.Id);
            branch.OrThrowNotFound("Chi nhánh", request.Id);

            if (branch.BranchCode != request.BranchCode)
            {
                var exists = await _unitOfWork.Branches.FirstOrDefaultAsync(x => x.BranchCode == request.BranchCode && !x.IsDeleted);
                if (exists != null) throw new DomainException($"Mã chi nhánh '{request.BranchCode}' đã tồn tại.");
            }

            branch.BranchCode = request.BranchCode;
            branch.BranchName = request.BranchName;

            _unitOfWork.Branches.Update(branch);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var branch = await _unitOfWork.Branches.GetByIdAsync(id);
            branch.OrThrowNotFound("Chi nhánh", id);

            branch.IsDeleted = true;

            _unitOfWork.Branches.Update(branch);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}

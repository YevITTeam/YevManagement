using Asset.Application.Dtos.SoftwareGroups;
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
    public class SoftwareGroupService : BaseService<IAssetUnitOfWork>, ISoftwareGroupService
    {
        public SoftwareGroupService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<SoftwareGroupDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.SoftwareGroups.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.GroupCode.Contains(keyword) || x.GroupName.Contains(keyword));
            }

            return await _unitOfWork.SoftwareGroups.ToPagedResponseAsync(
                query.OrderBy(x => x.GroupCode),
                pageIndex,
                pageSize,
                x => new SoftwareGroupDto { Id = x.Id, GroupCode = x.GroupCode, GroupName = x.GroupName }
            );
        }

        public async Task<List<SoftwareGroupDto>> GetAllActiveAsync()
        {
            var softwareGroups = await _unitOfWork.SoftwareGroups.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new SoftwareGroupDto { Id = x.Id, GroupCode = x.GroupCode, GroupName = x.GroupName }
            );
            return softwareGroups.OrderBy(x => x.GroupName).ToList();
        }

        public async Task<SoftwareGroupDto> GetByIdAsync(int id)
        {
            var softwareGroup = (await _unitOfWork.SoftwareGroups.GetByIdAsync(id)).OrThrowNotFound("Nhóm phần mềm", id);

            return new SoftwareGroupDto { Id = softwareGroup.Id, GroupCode = softwareGroup.GroupCode, GroupName = softwareGroup.GroupName };
        }

        public async Task<SoftwareGroupDto> CreateAsync(CreateSoftwareGroupDto request)
        {
            var exists = await _unitOfWork.SoftwareGroups.FirstOrDefaultAsync(x => x.GroupCode == request.GroupCode);
            exists.ThrowIfDuplicateCode("Mã nhóm phần mềm", request.GroupCode, x => x.IsDeleted);

            var newSoftwareGroup = new SoftwareGroup
            {
                GroupCode = request.GroupCode,
                GroupName = request.GroupName,
                IsDeleted = false
            };

            await _unitOfWork.SoftwareGroups.AddAsync(newSoftwareGroup);
            await _unitOfWork.SaveChangesAsync();

            return new SoftwareGroupDto { Id = newSoftwareGroup.Id, GroupCode = newSoftwareGroup.GroupCode, GroupName = newSoftwareGroup.GroupName };
        }

        public async Task UpdateAsync(UpdateSoftwareGroupDto request)
        {
            var softwareGroup = (await _unitOfWork.SoftwareGroups.GetByIdAsync(request.Id)).OrThrowNotFound("Nhóm phần mềm", request.Id);

            var exists = await _unitOfWork.SoftwareGroups.FirstOrDefaultAsync(
                x => x.GroupCode == request.GroupCode && x.Id != request.Id);
            exists.ThrowIfDuplicateCode("Mã nhóm phần mềm", request.GroupCode, x => x.IsDeleted);

            softwareGroup.GroupCode = request.GroupCode;
            softwareGroup.GroupName = request.GroupName;

            _unitOfWork.SoftwareGroups.Update(softwareGroup);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var softwareGroup = (await _unitOfWork.SoftwareGroups.GetByIdAsync(id)).OrThrowNotFound("Nhóm phần mềm", id);

            softwareGroup.IsDeleted = true;

            _unitOfWork.SoftwareGroups.Update(softwareGroup);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}

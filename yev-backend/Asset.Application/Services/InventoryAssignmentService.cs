using Asset.Application.Dtos.Inventory;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    public class InventoryAssignmentService : BaseService<IAssetUnitOfWork>, IInventoryAssignmentService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public InventoryAssignmentService(IAssetUnitOfWork unitOfWork, IHttpContextAccessor httpContextAccessor) : base(unitOfWork)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<List<InventoryAssignmentDto>> GetAllAsync()
        {
            var rows = await _unitOfWork.InventoryAssignments.SelectAsync(
                predicate: _ => true,
                selector: a => new InventoryAssignmentDto
                {
                    Id = a.Id,
                    UserId = a.UserId,
                    UserName = a.UserName,
                    FullName = a.FullName,
                    BranchId = a.BranchId,
                    BranchName = a.Branch.BranchName
                }
            );
            return rows.OrderBy(r => r.BranchName).ThenBy(r => r.UserName).ToList();
        }

        public async Task<InventoryAssignmentDto?> GetMyAssignmentAsync()
        {
            // ServerCheckUserContext only reads JWT claims, nothing ServerCheck-specific, so it is reused here.
            var userId = ServerCheckUserContext.GetUserId(_httpContextAccessor);
            if (userId == null) return null;

            var rows = await _unitOfWork.InventoryAssignments.SelectAsync(
                predicate: a => a.UserId == userId.Value,
                selector: a => new InventoryAssignmentDto
                {
                    Id = a.Id,
                    UserId = a.UserId,
                    UserName = a.UserName,
                    FullName = a.FullName,
                    BranchId = a.BranchId,
                    BranchName = a.Branch.BranchName
                }
            );
            return rows.FirstOrDefault();
        }

        public async Task<InventoryAssignmentDto> SaveAsync(SaveInventoryAssignmentDto request)
        {
            var branch = (await _unitOfWork.Branches.FirstOrDefaultAsync(b => b.Id == request.BranchId && !b.IsDeleted))
                .OrThrowNotFound("Xưởng", request.BranchId);

            var existing = await _unitOfWork.InventoryAssignments.FirstOrDefaultAsync(a => a.UserId == request.UserId);
            if (existing == null)
            {
                existing = new InventoryAssignment { UserId = request.UserId };
                await _unitOfWork.InventoryAssignments.AddAsync(existing);
            }
            else
            {
                _unitOfWork.InventoryAssignments.Update(existing);
            }

            existing.UserName = request.UserName.Trim();
            existing.FullName = string.IsNullOrWhiteSpace(request.FullName) ? null : request.FullName.Trim();
            existing.BranchId = branch.Id;

            await _unitOfWork.SaveChangesAsync();

            return new InventoryAssignmentDto
            {
                Id = existing.Id,
                UserId = existing.UserId,
                UserName = existing.UserName,
                FullName = existing.FullName,
                BranchId = branch.Id,
                BranchName = branch.BranchName
            };
        }

        public async Task DeleteAsync(int id)
        {
            var existing = (await _unitOfWork.InventoryAssignments.GetByIdAsync(id)).OrThrowNotFound("Phân công", id);
            _unitOfWork.InventoryAssignments.Delete(existing);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}

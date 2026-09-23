using Asset.Application.Dtos.ServerChecks;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    public class ServerCheckAssignmentService : BaseService<IAssetUnitOfWork>, IServerCheckAssignmentService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public ServerCheckAssignmentService(IAssetUnitOfWork unitOfWork, IHttpContextAccessor httpContextAccessor) : base(unitOfWork)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<List<ServerCheckAssignmentDto>> GetAllAsync()
        {
            var rows = await _unitOfWork.ServerCheckAssignments.SelectAsync(
                predicate: _ => true,
                selector: a => new ServerCheckAssignmentDto
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

        public async Task<ServerCheckAssignmentDto?> GetMyAssignmentAsync()
        {
            var userId = ServerCheckUserContext.GetUserId(_httpContextAccessor);
            if (userId == null) return null;

            var rows = await _unitOfWork.ServerCheckAssignments.SelectAsync(
                predicate: a => a.UserId == userId.Value,
                selector: a => new ServerCheckAssignmentDto
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

        public async Task<ServerCheckAssignmentDto> SaveAsync(SaveServerCheckAssignmentDto request)
        {
            var branch = (await _unitOfWork.Branches.FirstOrDefaultAsync(b => b.Id == request.BranchId && !b.IsDeleted))
                .OrThrowNotFound("Xưởng", request.BranchId);

            var existing = await _unitOfWork.ServerCheckAssignments.FirstOrDefaultAsync(a => a.UserId == request.UserId);
            if (existing == null)
            {
                existing = new ServerCheckAssignment { UserId = request.UserId };
                await _unitOfWork.ServerCheckAssignments.AddAsync(existing);
            }
            else
            {
                _unitOfWork.ServerCheckAssignments.Update(existing);
            }

            existing.UserName = request.UserName.Trim();
            existing.FullName = string.IsNullOrWhiteSpace(request.FullName) ? null : request.FullName.Trim();
            existing.BranchId = branch.Id;

            await _unitOfWork.SaveChangesAsync();

            return new ServerCheckAssignmentDto
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
            var existing = (await _unitOfWork.ServerCheckAssignments.GetByIdAsync(id)).OrThrowNotFound("Phân công", id);
            _unitOfWork.ServerCheckAssignments.Delete(existing);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}

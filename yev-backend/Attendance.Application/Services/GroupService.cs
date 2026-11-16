using Attendance.Application.Dtos.Groups;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Constants;
using Attendance.Domain.Entities;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class GroupService : BaseService<IAttendanceUnitOfWork>, IGroupService
    {
        public GroupService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<GroupDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword, int? workshopId = null)
        {
            var query = _unitOfWork.Groups.GetQueryable(false, x => x.Department, x => x.Workshop).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.GroupCode.Contains(keyword) || x.GroupNameVn.Contains(keyword));
            }

            if (workshopId.HasValue) query = query.Where(x => x.WorkshopId == workshopId.Value);

            return await _unitOfWork.Groups.ToPagedResponseAsync(
                query.OrderBy(x => x.GroupCode),
                pageIndex,
                pageSize,
                x => new GroupDto
                {
                    Id = x.Id,
                    GroupCode = x.GroupCode,
                    GroupNameVn = x.GroupNameVn,
                    GroupNameJp = x.GroupNameJp,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department.DepartmentNameVn,
                    WorkshopId = x.WorkshopId,
                    WorkshopNameVn = x.Workshop.WorkshopNameVn,
                    AllowEatLater = x.AllowEatLater,
                    LineKind = x.LineKind,
                    Lines = x.GroupLines.Select(l => new GroupLineDto
                    {
                        ProductionLineId = l.ProductionLineId,
                        ShiftTeamId = l.ShiftTeamId,
                        LineCode = l.ProductionLine.LineCode,
                        ShiftTeamCode = l.ShiftTeam.Code
                    }).ToList()
                }
            );
        }

        public async Task<List<GroupDto>> GetAllActiveAsync()
        {
            var groups = await _unitOfWork.Groups.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new GroupDto
                {
                    Id = x.Id,
                    GroupCode = x.GroupCode,
                    GroupNameVn = x.GroupNameVn,
                    GroupNameJp = x.GroupNameJp,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department.DepartmentNameVn,
                    WorkshopId = x.WorkshopId,
                    WorkshopNameVn = x.Workshop.WorkshopNameVn,
                    AllowEatLater = x.AllowEatLater,
                    LineKind = x.LineKind,
                    Lines = x.GroupLines.Select(l => new GroupLineDto
                    {
                        ProductionLineId = l.ProductionLineId,
                        ShiftTeamId = l.ShiftTeamId,
                        LineCode = l.ProductionLine.LineCode,
                        ShiftTeamCode = l.ShiftTeam.Code
                    }).ToList()
                }
            );
            return groups.OrderBy(x => x.GroupNameVn).ToList();
        }

        public async Task<List<GroupDto>> GetByDepartmentIdAsync(int departmentId, int? workshopId = null)
        {
            var groups = await _unitOfWork.Groups.SelectAsync(
                predicate: x => !x.IsDeleted && x.DepartmentId == departmentId && (workshopId == null || x.WorkshopId == workshopId),
                selector: x => new GroupDto
                {
                    Id = x.Id,
                    GroupCode = x.GroupCode,
                    GroupNameVn = x.GroupNameVn,
                    GroupNameJp = x.GroupNameJp,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department.DepartmentNameVn,
                    WorkshopId = x.WorkshopId,
                    WorkshopNameVn = x.Workshop.WorkshopNameVn,
                    AllowEatLater = x.AllowEatLater,
                    LineKind = x.LineKind,
                    Lines = x.GroupLines.Select(l => new GroupLineDto
                    {
                        ProductionLineId = l.ProductionLineId,
                        ShiftTeamId = l.ShiftTeamId,
                        LineCode = l.ProductionLine.LineCode,
                        ShiftTeamCode = l.ShiftTeam.Code
                    }).ToList()
                }
            );
            return groups.OrderBy(x => x.GroupNameVn).ToList();
        }

        public async Task<GroupDto> GetByIdAsync(int id)
        {
            var group = (await _unitOfWork.Groups.SelectAsync(x => x.Id == id, x => new GroupDto
            {
                Id = x.Id,
                GroupCode = x.GroupCode,
                GroupNameVn = x.GroupNameVn,
                GroupNameJp = x.GroupNameJp,
                DepartmentId = x.DepartmentId,
                DepartmentNameVn = x.Department.DepartmentNameVn,
                WorkshopId = x.WorkshopId,
                WorkshopNameVn = x.Workshop.WorkshopNameVn,
                AllowEatLater = x.AllowEatLater,
                LineKind = x.LineKind,
                Lines = x.GroupLines.Select(l => new GroupLineDto
                {
                    ProductionLineId = l.ProductionLineId,
                    ShiftTeamId = l.ShiftTeamId,
                    LineCode = l.ProductionLine.LineCode,
                    ShiftTeamCode = l.ShiftTeam.Code
                }).ToList()
            })).FirstOrDefault();
            return group.OrThrowNotFound("Nhóm", id)!;
        }

        public async Task<GroupDto> CreateAsync(CreateGroupDto request)
        {
            var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == request.DepartmentId && !x.IsDeleted);
            department.OrThrowNotFound("Bộ phận", request.DepartmentId);

            var workshop = await _unitOfWork.Workshops.FirstOrDefaultAsync(x => x.Id == request.WorkshopId && !x.IsDeleted);
            workshop.OrThrowNotFound("Xưởng", request.WorkshopId);

            var exists = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.GroupCode == request.GroupCode && !x.IsDeleted);
            if (exists != null) throw new DomainException($"Mã nhóm '{request.GroupCode}' đã tồn tại.");

            var newGroup = new Group
            {
                GroupCode = request.GroupCode,
                GroupNameVn = request.GroupNameVn,
                GroupNameJp = request.GroupNameJp,
                DepartmentId = request.DepartmentId,
                WorkshopId = request.WorkshopId,
                AllowEatLater = request.AllowEatLater,
                IsDeleted = false
            };
            await ApplyLinesAsync(newGroup, request.Lines, request.LineKind, request.TakeOverLines);
            await GroupLineDefaults.EnsureLinesAsync(_unitOfWork, newGroup);

            await _unitOfWork.Groups.AddAsync(newGroup);
            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(newGroup.Id);
        }

        public async Task UpdateAsync(UpdateGroupDto request)
        {
            var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == request.Id, x => x.GroupLines);
            group.OrThrowNotFound("Nhóm", request.Id);

            if (group!.GroupCode != request.GroupCode)
            {
                var exists = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.GroupCode == request.GroupCode && !x.IsDeleted);
                if (exists != null) throw new DomainException($"Mã nhóm '{request.GroupCode}' đã tồn tại.");
            }

            if (group.DepartmentId != request.DepartmentId)
            {
                var department = await _unitOfWork.Departments.GetByIdAsync(request.DepartmentId);
                department.OrThrowNotFound("Bộ phận", request.DepartmentId);
            }

            if (group.WorkshopId != request.WorkshopId)
            {
                var workshop = await _unitOfWork.Workshops.FirstOrDefaultAsync(x => x.Id == request.WorkshopId && !x.IsDeleted);
                workshop.OrThrowNotFound("Xưởng", request.WorkshopId);
            }

            group.GroupCode = request.GroupCode;
            group.GroupNameVn = request.GroupNameVn;
            group.GroupNameJp = request.GroupNameJp;
            group.DepartmentId = request.DepartmentId;
            group.WorkshopId = request.WorkshopId;
            group.AllowEatLater = request.AllowEatLater;
            await ApplyLinesAsync(group, request.Lines, request.LineKind, request.TakeOverLines);
            await GroupLineDefaults.EnsureLinesAsync(_unitOfWork, group);

            _unitOfWork.Groups.Update(group);
            await _unitOfWork.SaveChangesAsync();

            // Members follow the group's new pairs and kind.
            foreach (var member in await _unitOfWork.Employees.FindAsync(x => x.GroupId == group.Id && !x.IsDeleted))
                await GroupLineDefaults.ApplyAsync(_unitOfWork, member);
            await _unitOfWork.SaveChangesAsync();
        }

        private async Task ApplyLinesAsync(Group group, List<GroupLineDto> requested, string? lineKind, bool takeOver)
        {
            var pairs = requested.Select(x => (x.ProductionLineId, x.ShiftTeamId)).Distinct().ToList();
            var kind = StaffKinds.Normalize(lineKind);
            if (pairs.Count == 0)
            {
                group.LineKind = null;
                group.GroupLines.Clear();
                return;
            }
            if (kind != StaffKinds.Direct && kind != StaffKinds.Indirect)
                throw new DomainException("Nhóm gắn Line phải chọn Loại TT hoặc GT.");

            var lineIds = pairs.Select(x => x.ProductionLineId).Distinct().ToList();
            var lines = await _unitOfWork.ProductionLines.FindAsync(x => lineIds.Contains(x.Id) && !x.IsDeleted);
            if (lines.Count != lineIds.Count) throw new DomainException("Line không có trong danh mục.");
            var wrongWorkshop = lines.Where(x => x.WorkshopId != group.WorkshopId).Select(x => x.LineCode).ToList();
            if (wrongWorkshop.Count > 0) throw new DomainException($"Line {string.Join(", ", wrongWorkshop)} không thuộc Xưởng của Nhóm.");
            var wrongKind = lines.Where(x => !StaffKinds.AllowedOn(x).Contains(kind)).Select(x => x.LineCode).ToList();
            if (wrongKind.Count > 0) throw new DomainException($"Line {string.Join(", ", wrongKind)} không có nhân sự {kind}.");
            var shiftIds = pairs.Select(x => x.ShiftTeamId).Distinct().ToList();
            if ((await _unitOfWork.ProductionShiftTeams.FindAsync(x => shiftIds.Contains(x.Id) && !x.IsDeleted)).Count != shiftIds.Count)
                throw new DomainException("Ca không có trong danh mục.");

            // The import resolves an employee's group from (workshop, department, kind, Line × Ca), so that key must be unique.
            // Only pairs this save introduces count, so groups that already clash stay editable until Admin merges them.
            var introduced = group.LineKind == kind
                ? pairs.Where(p => !group.GroupLines.Any(x => x.ProductionLineId == p.ProductionLineId && x.ShiftTeamId == p.ShiftTeamId)).ToList()
                : pairs;
            var introducedLineIds = introduced.Select(p => p.ProductionLineId).ToList();
            var owners = await _unitOfWork.Groups.FindWithIncludesAsync(
                x => !x.IsDeleted && x.Id != group.Id && x.WorkshopId == group.WorkshopId && x.DepartmentId == group.DepartmentId && x.LineKind == kind
                    && x.GroupLines.Any(l => introducedLineIds.Contains(l.ProductionLineId)),
                x => x.GroupLines);
            var clashes = owners.SelectMany(o => o.GroupLines.Where(l => introduced.Contains((l.ProductionLineId, l.ShiftTeamId))).Select(l => (Owner: o, Line: l))).ToList();
            if (clashes.Count > 0 && !takeOver)
            {
                var codes = (await _unitOfWork.ProductionLines.FindAsync(x => lineIds.Contains(x.Id))).ToDictionary(x => x.Id, x => x.LineCode);
                throw new DomainException($"Đã thuộc Nhóm {kind} khác cùng Phòng ban: {string.Join(", ", clashes.Select(x => $"{codes[x.Line.ProductionLineId]} ({x.Owner.GroupCode})"))}.");
            }
            foreach (var (owner, line) in clashes)
            {
                owner.GroupLines.Remove(line);
                foreach (var member in await _unitOfWork.Employees.FindAsync(x => x.GroupId == owner.Id && !x.IsDeleted
                    && x.ProductionLineId == line.ProductionLineId && x.ShiftTeamId == line.ShiftTeamId))
                    member.Group = group;
            }
            // A group left without pairs keeps the "every group has a Line × Ca" rule; Admin deletes it once empty.
            foreach (var emptied in clashes.Select(x => x.Owner).Distinct().Where(o => o.GroupLines.Count == 0))
                await GroupLineDefaults.EnsureLinesAsync(_unitOfWork, emptied);

            group.LineKind = kind;
            foreach (var stale in group.GroupLines.Where(x => !pairs.Contains((x.ProductionLineId, x.ShiftTeamId))).ToList())
                group.GroupLines.Remove(stale);
            foreach (var (lineId, shiftId) in pairs.Where(p => !group.GroupLines.Any(x => x.ProductionLineId == p.ProductionLineId && x.ShiftTeamId == p.ShiftTeamId)))
                group.GroupLines.Add(new GroupLine { ProductionLineId = lineId, ShiftTeamId = shiftId });
        }

        public async Task DeleteAsync(int id)
        {
            var group = await _unitOfWork.Groups.GetByIdAsync(id);
            group.OrThrowNotFound("Nhóm", id);

            group!.IsDeleted = true;

            _unitOfWork.Groups.Update(group);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}

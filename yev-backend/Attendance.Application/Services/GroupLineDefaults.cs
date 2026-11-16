using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Constants;
using Attendance.Domain.Entities;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Everyone in a group carries line data: a group without Line × Ca gets one named after it, members default to its first pair.
    internal static class GroupLineDefaults
    {
        public const string FallbackCode = "GT A";
        public const string FallbackTaskName = "Office";

        // Group must be tracked with GroupLines loaded.
        public static async Task EnsureLinesAsync(IAttendanceUnitOfWork uow, Group group)
        {
            if (group.GroupLines.Count > 0) return;
            var code = group.GroupNameVn.Trim();
            code = code[..Math.Min(50, code.Length)];
            var line = await uow.ProductionLines.FirstOrDefaultAsync(x => x.WorkshopId == group.WorkshopId && x.LineCode == code && !x.IsDeleted);
            if (line == null)
            {
                var team = await uow.ProductionTeams.FirstOrDefaultAsync(x => x.WorkshopId == group.WorkshopId && x.Code == FallbackCode && !x.IsDeleted)
                    ?? new ProductionTeam { WorkshopId = group.WorkshopId, Code = FallbackCode };
                line = new ProductionLine { WorkshopId = group.WorkshopId, LineCode = code, Team = team, CongDoan = FallbackCode };
                await uow.ProductionLines.AddAsync(line);
            }
            var hc = (await uow.ProductionShiftTeams.FirstOrDefaultAsync(x => x.Code == "HC" && !x.IsDeleted)).OrThrowNotFound("Nhóm ca", "HC")!;
            if (line.Id != 0 && await uow.Groups.FirstOrDefaultAsync(x => !x.IsDeleted && x.Id != group.Id && x.WorkshopId == group.WorkshopId
                    && x.DepartmentId == group.DepartmentId && x.GroupLines.Any(l => l.ProductionLineId == line.Id && l.ShiftTeamId == hc.Id)) != null)
                throw new DomainException($"Line '{code}' × HC đã thuộc Nhóm khác cùng Phòng ban — đổi tên Nhóm hoặc chọn Line × Ca.");
            group.GroupLines.Add(new GroupLine { ProductionLine = line, ShiftTeamId = hc.Id });
        }

        // Mã nhóm = {Phòng}-{Line}-{Ca} of the first pair; when another workshop's group already has it, -{Xưởng} is added.
        public static async Task AssignCodeAsync(IAttendanceUnitOfWork uow, Group group)
        {
            var first = group.GroupLines.OrderBy(l => l.Id == 0 ? int.MaxValue : l.Id).FirstOrDefault();
            if (first == null) return;
            var lineCode = first.ProductionLine?.LineCode ?? (await uow.ProductionLines.GetByIdAsync(first.ProductionLineId))!.LineCode;
            var shiftCode = (await uow.ProductionShiftTeams.GetByIdAsync(first.ShiftTeamId))!.Code;
            var departmentCode = (await uow.Departments.GetByIdAsync(group.DepartmentId))!.DepartmentCode;
            var code = Fit($"{departmentCode}-{lineCode}-{shiftCode}");
            if (await uow.Groups.FirstOrDefaultAsync(x => !x.IsDeleted && x.Id != group.Id && x.GroupCode == code) != null)
                code = Fit($"{code}-{(await uow.Workshops.GetByIdAsync(group.WorkshopId))!.WorkshopCode}");
            group.GroupCode = code;
        }

        // After a Line, Ca or Phòng ban code changes.
        public static async Task RefreshCodesAsync(IAttendanceUnitOfWork uow, System.Linq.Expressions.Expression<Func<Group, bool>> which)
        {
            foreach (var group in await uow.Groups.FindWithIncludesAsync(which, x => x.GroupLines))
                await AssignCodeAsync(uow, group);
        }

        private static string Fit(string code) => code.Trim()[..Math.Min(50, code.Trim().Length)];

        // Keeps a pair the group covers; otherwise takes the group's first Line × Ca. Fills C_doan and task when missing; TT/GT follows the task.
        public static async Task ApplyAsync(IAttendanceUnitOfWork uow, Employee employee)
        {
            if (employee.GroupId == null) return;
            var group = (await uow.Groups.SelectAsync(x => x.Id == employee.GroupId, x => new
            {
                x.WorkshopId,
                Lines = x.GroupLines.OrderBy(l => l.Id).Select(l => new
                {
                    l.ProductionLineId, l.ShiftTeamId, l.ProductionLine.TeamId, l.ProductionLine.CongDoan
                }).ToList()
            })).SingleOrDefault();
            if (group == null || group.Lines.Count == 0) return;

            var pair = group.Lines.FirstOrDefault(l => l.ProductionLineId == employee.ProductionLineId && l.ShiftTeamId == employee.ShiftTeamId) ?? group.Lines[0];
            if (employee.ProductionLineId != pair.ProductionLineId) employee.CongDoan = null;
            employee.ProductionLineId = pair.ProductionLineId;
            employee.ShiftTeamId = pair.ShiftTeamId;
            employee.TeamId = pair.TeamId;
            employee.CongDoan ??= pair.CongDoan;
            // Office (GT) is only a default for office lines, never for someone already marked TT.
            if (pair.CongDoan == FallbackCode && employee.StaffKind != StaffKinds.Direct) employee.TaskName ??= FallbackTaskName;
            if (employee.TaskName != null)
                employee.StaffKind = (await uow.ProductionTasks.FirstOrDefaultAsync(x => x.WorkshopId == group.WorkshopId && x.Code == employee.TaskName && !x.IsDeleted))?.StaffKind
                    ?? employee.StaffKind;
        }
    }
}

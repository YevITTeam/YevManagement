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
                line = new ProductionLine { WorkshopId = group.WorkshopId, LineCode = code, Team = team, CongDoan = FallbackCode, HasIndirectStaff = true };
                await uow.ProductionLines.AddAsync(line);
            }
            var hc = (await uow.ProductionShiftTeams.FirstOrDefaultAsync(x => x.Code == "HC" && !x.IsDeleted)).OrThrowNotFound("Nhóm ca", "HC")!;
            group.LineKind = StaffKinds.AllowedOn(line).Contains(StaffKinds.Indirect) ? StaffKinds.Indirect : StaffKinds.Direct;
            group.GroupLines.Add(new GroupLine { ProductionLine = line, ShiftTeamId = hc.Id });
        }

        // Keeps a pair the group covers; otherwise takes the group's first Line × Ca. Fills TT/GT, C_doan and task when missing.
        public static async Task ApplyAsync(IAttendanceUnitOfWork uow, Employee employee)
        {
            if (employee.GroupId == null) return;
            var group = (await uow.Groups.SelectAsync(x => x.Id == employee.GroupId, x => new
            {
                x.LineKind,
                Lines = x.GroupLines.OrderBy(l => l.Id).Select(l => new
                {
                    l.ProductionLineId, l.ShiftTeamId, l.ProductionLine.TeamId, l.ProductionLine.CongDoan,
                    l.ProductionLine.HasDirectStaff, l.ProductionLine.HasIndirectStaff
                }).ToList()
            })).SingleOrDefault();
            if (group == null || group.Lines.Count == 0) return;

            var pair = group.Lines.FirstOrDefault(l => l.ProductionLineId == employee.ProductionLineId && l.ShiftTeamId == employee.ShiftTeamId) ?? group.Lines[0];
            var allowed = StaffKinds.AllowedOn(pair.HasDirectStaff, pair.HasIndirectStaff);
            if (employee.ProductionLineId != pair.ProductionLineId) employee.CongDoan = null;
            employee.ProductionLineId = pair.ProductionLineId;
            employee.ShiftTeamId = pair.ShiftTeamId;
            employee.TeamId = pair.TeamId;
            employee.StaffKind = group.LineKind != null && allowed.Contains(group.LineKind) ? group.LineKind
                : allowed.Contains(employee.StaffKind ?? "") ? employee.StaffKind : allowed[0];
            employee.CongDoan ??= pair.CongDoan;
            if (pair.CongDoan == FallbackCode) employee.TaskName ??= FallbackTaskName;
        }
    }
}

using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class WorkCalendarDayRepository : GenericRepository<WorkCalendarDay, AttendanceDbContext>, IWorkCalendarDayRepository
    {
        public WorkCalendarDayRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}

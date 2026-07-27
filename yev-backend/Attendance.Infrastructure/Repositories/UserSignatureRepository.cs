using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class UserSignatureRepository : GenericRepository<UserSignature, AttendanceDbContext>, IUserSignatureRepository
    {
        public UserSignatureRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}

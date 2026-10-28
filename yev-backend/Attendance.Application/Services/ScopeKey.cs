namespace Attendance.Application.Services
{
    // Folds a (Department, Workshop) pair into one int so EF can translate Contains over pairs.
    internal static class ScopeKey
    {
        public const int Factor = 100_000;

        public static int Of(int departmentId, int workshopId) => departmentId * Factor + workshopId;
    }
}

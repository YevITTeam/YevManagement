namespace Asset.Application.Dtos.ServerChecks
{
    public class ServerCheckAssignmentDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = null!;
        public string? FullName { get; set; }
        public int BranchId { get; set; }
        public string BranchName { get; set; } = null!;
    }
}

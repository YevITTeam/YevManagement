namespace Attendance.Application.Dtos.OtForms
{
    // Lets the FE pre-fill/limit the Group choice since creators only belong to fixed Groups.
    public class MyCreateScopeItemDto
    {
        public int GroupId { get; set; }
        public string GroupNameVn { get; set; } = null!;
        public int DepartmentId { get; set; }
        public string DepartmentNameVn { get; set; } = null!;
    }
}

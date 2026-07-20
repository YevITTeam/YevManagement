namespace Attendance.Application.Dtos.OtForms
{
    // 1 Bộ phận (Group) mà người gọi được phép tạo/ký đơn — dùng để FE tự điền sẵn (hoặc giới hạn
    // dropdown) thay vì bắt người tạo đơn tự chọn Group/Department từ toàn bộ danh sách, vì họ vốn
    // chỉ thuộc/được gán đúng 1 (hoặc vài) Bộ phận cố định.
    public class MyCreateScopeItemDto
    {
        public int GroupId { get; set; }
        public string GroupNameVn { get; set; } = null!;
        public int DepartmentId { get; set; }
        public string DepartmentNameVn { get; set; } = null!;
    }
}

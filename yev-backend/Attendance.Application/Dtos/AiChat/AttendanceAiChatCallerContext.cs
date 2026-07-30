namespace Attendance.Application.Dtos.AiChat
{
    // Identity of the person actually chatting, threaded explicitly from the Controller down to the
    // tool executor — Attendance.Application has no IHttpContextAccessor anywhere (every OtFormService
    // method takes identity as explicit string/bool parameters instead, see OtFormController.Create),
    // and this feature is no exception. Bundled into 1 record (instead of 3 loose parameters) because,
    // unlike Asset's 17 read-only tools which never needed identity at all, almost every tool here
    // does (get_my_create_scopes always does; create_ot_form_draft always does).
    public class AttendanceAiChatCallerContext
    {
        public string UserName { get; set; } = null!;
        public string? FullName { get; set; }
        public bool IsAdmin { get; set; }
    }
}

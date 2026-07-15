namespace Attendance.Application.Dtos.OtForms
{
    public class ProcessPartDto
    {
        public bool IsEat { get; set; }
        public bool IsTransportation { get; set; }
        public bool IsUseCopyRoom { get; set; }
        public string? AnotherSuggestionVn { get; set; }
        public string? AnotherSuggestionJp { get; set; }
    }
}

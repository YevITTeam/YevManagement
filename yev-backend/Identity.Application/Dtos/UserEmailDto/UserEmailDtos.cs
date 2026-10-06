using System.ComponentModel.DataAnnotations;

namespace Identity.Application.Dtos.UserEmailDto
{
    public class UserEmailDto
    {
        public int Id { get; set; }
        public string Email { get; set; } = null!;
        // UserEmailSource
        public int Source { get; set; }
        public bool IsPrimary { get; set; }
        public string? Note { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // Module routing row: UserEmailId null = the module sends to the primary address.
    public class UserEmailModuleAssignmentDto
    {
        public string ModuleCode { get; set; } = null!;
        public string ModuleName { get; set; } = null!;
        public bool IsApplied { get; set; }
        public int? UserEmailId { get; set; }
    }

    public class UserEmailOverviewDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = null!;
        public string? FullName { get; set; }
        public List<UserEmailDto> Emails { get; set; } = new();
        public List<UserEmailModuleAssignmentDto> Modules { get; set; } = new();
    }

    public class CreateUserEmailDto
    {
        [Required(ErrorMessage = "Email là bắt buộc.")]
        [EmailAddress(ErrorMessage = "Email không hợp lệ.")]
        [StringLength(255, ErrorMessage = "Email tối đa 255 ký tự.")]
        public string Email { get; set; } = null!;

        // UserEmailSource; Manual when typed by hand, the suggestion's source when added from a suggestion.
        [Range(0, 3, ErrorMessage = "Nguồn email không hợp lệ.")]
        public int Source { get; set; } = 3;

        [StringLength(255, ErrorMessage = "Ghi chú tối đa 255 ký tự.")]
        public string? Note { get; set; }

        public bool IsPrimary { get; set; }
    }

    public class UpdateUserEmailModulesDto
    {
        public List<UserEmailModuleItemDto> Items { get; set; } = new();
    }

    public class UserEmailModuleItemDto
    {
        [Required(ErrorMessage = "Mã module là bắt buộc.")]
        public string ModuleCode { get; set; } = null!;

        // Null = use the primary address.
        public int? UserEmailId { get; set; }
    }

    public class UserEmailSuggestionDto
    {
        public string Email { get; set; } = null!;
        // UserEmailSource
        public int Source { get; set; }
        public string? Note { get; set; }
        public bool AlreadyAdded { get; set; }
    }
}
